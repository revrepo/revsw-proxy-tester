/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2015] Rev Software, Inc.
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Rev Software, Inc. and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Rev Software, Inc.
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Rev Software, Inc.
 */

//  ----------------------------------------------------------------------------------------------//
'use strict';
/*jshint -W079 */

var app_config = require('config'),
  _ = require('underscore'),
  elastic = require('elasticsearch'),
  Promise = require('bluebird'),
  logger = require('revsw-logger')(app_config.get('log_config'));

//  ---------------------------------
//  create logstash index name for the current date(today): "logstash-2015.10.01"
var last_index_ = function() {
  return 'logstash-' + (new Date()).toISOString().substr(0, 10).replace(/\-/g, '.');
};

//  ---------------------------------
//  defaults
var logs_config = {
  topAgents: 50,
  topReferers: 100,
  topURLs: 100,
  minCount: 200, //  least amount of hits for the any combination of the url, port, method, agent and referer
};

var client = new elastic.Client({
  host: app_config.get('elastic').host,
  apiVestion: app_config.get('elastic').version,
  log: [{
    type: 'stdio',
    levels: ['error', 'warning']
  }],
  // requestTimeout: 300000
  requestTimeout: Infinity
});

//  ----------------------------------------------------------------------------------------------//

//  simple check cluster's health status
//  pars may contain
//      level: "cluster"(default) | "indices" | "shards"
exports.health = function(pars) {

  return client.cluster.health(pars)
    .error(function(err) {
      logger.error('Logs model, health(...), Elasticsearch error:', err);
    });
};

//  ---------------------------------
//  returns promise which gets an indices list as a string
//  pars may contain
//      index: string | array of strings, default "logstash-*"
//      v: true, column names
exports.indicesList = function(pars) {

  pars = pars || {};
  pars.index = pars.index || 'logstash-*';
  if (pars.verbose) {
    pars.v = true;
  }

  return client.cat.indices(pars)
    .error(function(err) {
      logger.error('Logs model, indicesList(...), Elasticsearch error:', err);
    });
};

//  ---------------------------------
//  [domain] field aggregation
//  returns promise which gets an array with domain names as argument
//  pars may contain
//      index: string | array of strings, default is logstash-YYYY.MM.DD, where YYYY.MM.DD is today
//      size: maximum size of result, default: 100
//      min_doc_count: result will contain domains which have been found in such amount hits or more, default: 1000
exports.domainsList = function(pars) {

  pars = pars || {};

  return client.search({
    index: pars.index || last_index_(),
    size: 0,
    body: {
      aggs: {
        group_by_domain: {
          terms: {
            field: 'domain.raw',
            size: pars.size || 100,
            min_doc_count: pars.min_doc_count || 1000,
            exclude: '-'
          },
        },
      },
    }
  }).then(function(resp) {
    return resp.aggregations.group_by_domain.buckets;
  }).error(function(err) {
    logger.error('Logs model, domainsList(...), Elasticsearch error:', err);
  });
};

//  top requests collector -----------------------------------------------------------------------//

//  cached parameters
var curr_pars = {};

//  ---------------------------------
//  convert retrieved multi-level aggregation into a flat array
var handle_aggregated_stage_1_ = function(resp) {

  var current = {};
  var flat = [];

  _.each(resp.aggregations.group_by_method.buckets, function(method) {
    current.method = method.key;
    _.each(method.group_by_port.buckets, function(port) {
      current.ipport = port.key;
      _.each(port.group_by_request.buckets, function(request) {

        current.request = request.key;
        current.count = request.doc_count;
        flat.push(_.clone(current));

      });
    });
  });

  return flat;
};

//  ---------------------------------
//  convert retrieved multi-level aggregation into a flat array
var handle_aggregated_stage_2_ = function(resp) {

  var flat = [];

  _.each(resp, function(item) {

    var current = {
      method: item.method,
      ipport: item.ipport,
      request: item.request,
    };
    _.each(item.lvl2.aggregations.group_by_agent.buckets, function(agent) {
      current.agent = agent.key;
      _.each(agent.group_by_referer.buckets, function(referer) {
        current.referer = referer.key;
        current.count = referer.doc_count;
        flat.push(current);
      });
    });

  });

  return flat;
};

//  ---------------------------------
// { method: 'get',
//   ipport: '80',
//   request: '/Images/Topics/TopicTypes/comedy_skit.png',
//   count: 58552 }
var run_second_query_ = function(data) {

  logger.verbose('  second lvl query for: ' + data.method + ':' + data.ipport + data.request);

  return client.search({
    index: curr_pars.index,
    size: 0,
    body: {
      query: {
        filtered: {
          filter: {
            bool: {
              must: [{
                term: {
                  'domain.raw': curr_pars.domain
                }
              }, {
                term: {
                  method: data.method
                }
              }, {
                term: {
                  ipport: data.ipport
                }
              }, {
                term: {
                  'request.raw': data.request
                }
              }, ]
            }
          }
        }
      },
      aggs: {
        group_by_agent: {
          terms: {
            field: 'agent.raw',
            size: curr_pars.topAgents,
            min_doc_count: curr_pars.minCount2Lvl,
            collect_mode: 'breadth_first',
          },
          aggs: {
            group_by_referer: {
              terms: {
                field: 'referer.raw',
                size: curr_pars.topReferers,
                min_doc_count: curr_pars.minCount2Lvl,
                collect_mode: 'breadth_first',
              }
            }
          }
        }
      }
    }
  }).then(function(resp) {

    logger.verbose('   COMPLETED 2nd lvl query for: ' + data.method + ':' + data.ipport + data.request + '(' + ( ++curr_pars.rcount ) + ')');
    data.lvl2 = resp;
    return data;
  });
};

//  ---------------------------------
//  collect most frequent requests using multi-level aggregation

//  CAUTION:
//  this function puts a heavy load on ES cluster, do not run it with broad index filter (logstash-* or just *)

//  returns promise which gets an array with collected requests:
//  {  count: 3864355,
//     domain: "portal-qa-domain.revsw.net",
//     method: "get",
//     ipport: "80",
//     agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53 BingPreview/1.0b",
//     referer: "http://www.metacafe.com/watch/yt-5gr4M7T9xeQ/",
//     request: "/"
//  }
//  pars: {
//      domain: domain name, [required]
//      index: string, default is logstash-YYYY.MM.DD, where YYYY.MM.DD is today, see CAUTION above
//      topAgents: number of top agent variants, default logs_config.topAgents
//      topReferers: number of top referer variants, default logs_config.topReferers
//      topURLs: number of top request variants, default logs_config.topURLs
//      minCount: least amount of hits for every combination, default logs_config.minCount
//      verbose: additional info about second level requests
//  }

exports.aggregateTopRequests = function(pars) {

  pars = pars || {};
  if (pars.index === '*' || pars.index === 'logstash*' || pars.index === 'logstash-*') {
    throw (new RangeError('Too wide indices select!'));
  }

  _.defaults(pars, logs_config);
  pars.index = pars.index || last_index_();
  pars.minCount = parseInt(pars.minCount);
  pars.minCount2Lvl = pars.minCount / 4;
  curr_pars = pars;
  curr_pars.rcount = 0;

  if (pars.verbose) {
    logger.transports.console.level = 'verbose';
  }
  logger.info('run 1st lvl aggregation');
  logger.verbose('config: ', pars);

  return client.search({

    index: pars.index,
    size: 0,
    body: {
      query: {
        term: {
          'domain.raw': pars.domain
        },
      },
      aggs: {
        group_by_method: {
          terms: {
            field: 'method',
            size: 10,
            min_doc_count: pars.minCount,
            // depth_first/breadth_first, https://www.elastic.co/guide/en/elasticsearch/guide/current/_preventing_combinatorial_explosions.html
            collect_mode: 'breadth_first',
          },
          aggs: {
            group_by_port: {
              terms: {
                field: 'ipport',
                size: 2, //  80 | 443
                min_doc_count: pars.minCount,
                collect_mode: 'breadth_first',
              },
              aggs: {
                group_by_request: {
                  terms: {
                    field: 'request.raw',
                    size: pars.topURLs,
                    min_doc_count: pars.minCount,
                    collect_mode: 'breadth_first',
                  },
                }
              }
            }
          }
        }
      }
    }
  }).then(function(resp) {

    var responses = handle_aggregated_stage_1_(resp);
    logger.info('1st lvl done, ' + responses.length + ' records');

    return Promise.map(responses, run_second_query_, {
      concurrency: 4
    });

  }).then(function(resp) {

    var responses = handle_aggregated_stage_2_(resp);
    logger.info('2nd lvl done, ' + responses.length + ' records');

    return responses;

  }).error(function(err) {
    logger.error('Logs model, aggregateTopRequests(...), Elasticsearch error:', err);
  });
};
