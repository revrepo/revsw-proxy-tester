
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

var app_config = app_require( 'config/app.js' ),
    _ = require( 'underscore' ),
    elastic = require( 'elasticsearch' );

//  ---------------------------------
//  create logstash index name for the current date(today): "logstash-2015.10.01"
var last_index = function() {
    return 'logstash-' + ( new Date() ).toISOString().substr( 0, 10 ).replace( /\-/g, '.' );
}

//  ---------------------------------
//  defaults
var logs_config = {
    indices: last_index(),
    topAgents: 50,
    topReferers: 100,
    topURLs: 100,
    aggsCollectMode: 'breadth_first',   //  depth_first/breadth_first, https://www.elastic.co/guide/en/elasticsearch/guide/current/_preventing_combinatorial_explosions.html,
    minCount: 200,                      //  least amount of hits for the any combination of the url, port, method, agent and referer
};

var client = new elastic.Client( {
    host: app_config.elastic.host,
    apiVestion: app_config.elastic.version,
    log: [{
        type: 'stdio',
        levels: ['error', 'warning']
    }],
    // requestTimeout: 300000
    requestTimeout: Infinity
} );

//  ----------------------------------------------------------------------------------------------//

//  simple check cluster's health status
//  pars may contain
//      level: "cluster"(default) | "indices" | "shards"
var health = exports.health = function( pars ) {

    return client.cluster.health( pars )
        .error( function( err ) {
            console.trace( 'Logs model, health(...), Elasticsearch error:', err );
        });
}

//  ---------------------------------
//  [domain] field aggregation
//  returns promise which gets an array with domain names as argument
//  pars may contain
//      index: string | array of strings, default is logstash-YYYY.MM.DD, where YYYY.MM.DD is today
//      size: maximum size of result, default: 100
//      min_doc_count: result will contain domains which have been found in such amount hits or more, default: 1000
var domainsList = exports.domainsList = function( pars ) {

    pars = pars || {};

    return client.search({
        index: pars.index || config.indices,
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
    }).then( function( resp ) {
        return resp.aggregations.group_by_domain.buckets;
    }).error( function( err ) {
        console.trace( 'Logs model, domainsList(...), Elasticsearch error:', err );
    });
}

//  ---------------------------------
//  returns promise which gets an indices list as a string
//  pars may contain
//      index: string | array of strings, default "logstash-*"
//      v: true, column names
var indicesList = exports.indicesList = function( pars ) {

    pars = pars || {};
    pars.index = pars.index || 'logstash-*';

    return client.cat.indices( pars )
        .error( function( err ) {
            console.trace( 'Logs model, indicesList(...), Elasticsearch error:', err );
        });
}

//  top requests collector -----------------------------------------------------------------------//

//  ---------------------------------
//  convert retrieved multi-level aggregation into a flat array
var handle_aggregated_ = function( resp ) {

    var current = { referer: '' };
    var flat = [];

    _.each( resp.aggregations.group_by_domain.buckets, function( domain ) {
        current.domain = domain.key;
        _.each( domain.group_by_method.buckets, function( method ) {
            current.method = method.key;
            _.each( method.group_by_port.buckets, function( port ) {
                current.ipport = port.key;
                _.each( port.group_by_agent.buckets, function( agent ) {
                    current.agent = agent.key;

                    if ( agent.group_by_referer ) {
                        _.each( agent.group_by_referer.buckets, function( referer ) {
                            current.referer = referer.key;
                            _.each( referer.group_by_URL.buckets, function( url ) {
                                current.request = url.key;
                                current.count = url.doc_count;
                                flat.push( _.clone( current ) );
                            } );
                        });
                    } else {
                        _.each( agent.group_by_URL.buckets, function( url ) {
                            current.request = url.key;
                            current.count = url.doc_count;
                            flat.push( _.clone( current ) );
                        } );
                    }

                } );
            } );
        } );
    });

    // console.dir( flat, { colors: false, depth: null } );
    return flat;
}

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
//  pars may contain
//      index: string | array of strings, default is logstash-YYYY.MM.DD, where YYYY.MM.DD is today, see CAUTION above, no
//      domains: string or array of strings with domain names, optional
//      size: maximum size of domains, default: 100
//      topAgents: number of top agent variants, default logs_config.topAgents
//      topReferers: number of top referer variants, default logs_config.topReferers
//      topURLs: number of top URL variants, default logs_config.topURLs
//      minCount: least amount of hits for every combination, default logs_config.minCount
var aggregateTopRequests = exports.aggregateTopRequests = function( pars ) {

    pars = pars || {};

    var inner_query = pars.domains ? {
        terms: {
            'domain.raw': pars.domains
        }
    } : {
        match_all: {}
    };
    var no_ref_filter = {
        missing: {
            field: 'referer'
        }
    };
    var ref_filter = {
        exists: {
            field: 'referer'
        }
    };

    var no_ref_aggs = {
        group_by_URL: {
            terms: {
                field: 'request.raw',
                size: pars.topURL || logs_config.topURLs,
                min_doc_count: pars.minCount || logs_config.minCount,
                collect_mode: logs_config.aggsCollectMode,
            },
        }
    };
    var ref_aggs = {
        group_by_referer: {
            terms: {
                field: 'referer.raw',
                size: logs_config.topReferers,
                min_doc_count: pars.minCount || logs_config.minCount,
                collect_mode: logs_config.aggsCollectMode,
            },
            aggs: no_ref_aggs
        }
    };
    var aggs = {
        group_by_domain: {
            terms: {
                field: 'domain.raw',
                size: pars.size || 100,
                min_doc_count: pars.minCount || logs_config.minCount,
                collect_mode: logs_config.aggsCollectMode,
                exclude: '-'
            },
            aggs: {
                group_by_method: {
                    terms: {
                        field: 'method',
                        size: 10,
                        min_doc_count: pars.minCount || logs_config.minCount,
                        collect_mode: logs_config.aggsCollectMode,
                    },
                    aggs: {
                        group_by_port: {
                            terms: {
                                field: 'ipport',
                                size: 2,    //  80 | 443
                                min_doc_count: pars.minCount || logs_config.minCount,
                                collect_mode: logs_config.aggsCollectMode,
                            },
                            aggs: {
                                group_by_agent: {
                                    terms: {
                                        field: 'agent.raw',
                                        size: pars.topAgents || logs_config.topAgents,
                                        min_doc_count: pars.minCount || logs_config.minCount,
                                        collect_mode: logs_config.aggsCollectMode,
                                    },
                                    aggs: ref_aggs
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    var result;
    return client.search({

        index: pars.index || logs_config.indices,
        size: 0,
        body: {
            query: {
                filtered: {
                    query: inner_query,
                    filter: ref_filter
                }
            },
            aggs: aggs
        }
    }).then( function( resp ) {

        //  debug
        // console.dir( resp, { colors: false, depth: null } );
        //  debug

        result = handle_aggregated_( resp );

    }).then( function() {

        aggs.group_by_domain.aggs.group_by_method.aggs.group_by_port.aggs.group_by_agent.aggs = no_ref_aggs;
        return client.search({

            index: pars.index || logs_config.indices,
            size: 0,
            body: {
                query: {
                    filtered: {
                        query: inner_query,
                        filter: no_ref_filter
                    }
                },
                aggs: aggs
            }
        });
    }).then( function( resp ) {

        //  debug
        // console.dir( resp, { colors: false, depth: null } );
        //  debug

        return result.concat( handle_aggregated_( resp ) )

    }).error( function( err ) {
        console.trace( 'Logs model, aggregateTopRequests(...), Elasticsearch error:', err );
    });
}

//  ---------------------------------
//  parse retrieved strings and store it into flat array
var handle_collected_ = function( resp ) {

    var flat = [];
    var test = /(.+?):(\d{2,3})(.*?)::(\w+)::(.*?)::(.*)/g;

    _.each( resp.aggregations.group_by_6_fields.buckets, function( item ) {
        test.lastIndex = 0;
        var keys = test.exec( item.key );
        if ( keys === null ) {
            console.log( 'Logs model, handle_collected_(...), item parse error, key:[ ' + item.key + ' ]' );
            return;
        }
        flat.push({
            count: item.doc_count,
            domain: keys[1],
            method: keys[4],
            ipport: keys[2],
            agent: keys[5],
            referer: keys[6].replace( /^\[|\]$/g, '' ),
            request: keys[3].replace( 'null', '/' )
        });
    });

    // console.dir( flat, { colors: false, depth: null } );
    return flat;
}

//  ---------------------------------
//  collect most frequent requests using stored fields concatenation function and one level aggregation
//  fields concatenation function returns domain+port+request+method+agent+referer and this string's being used for aggregation

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
//  pars may contain
//      index: string | array of strings, default is logstash-YYYY.MM.DD, where YYYY.MM.DD is today, see CAUTION above, no
//      domains: string or array of strings with domain names, optional
//      size: maximum size of domains, default: 100
//      minCount: least amount of hits for every combination, default logs_config.minCount
var collectTopRequests = exports.collectTopRequests = function( pars ) {

    pars = pars || {};

    var body = {
        aggs: {
            group_by_6_fields: {
                terms: {
                    script_file: 'aggs',
                    size: pars.size || 100,
                    min_doc_count: pars.minCount || logs_config.minCount,
                    collect_mode: 'breadth_first',
                    exclude: '-:*'
                },
            },
        },
    }

    if ( pars.domains ) {
        body.query = {
            terms: {
                'domain.raw': pars.domains
            }
        }
    }

    return client.search({

        index: pars.index || logs_config.indices,
        size: 0,
        body: body

    }).then( function( resp ) {

        //  debug
        // console.dir( resp, { colors: false, depth: null } );
        //  debug

        return handle_collected_( resp );

    }).error( function( err ) {
        console.trace( 'Logs model, collectTopRequests(...), Elasticsearch error:', err );
    });
}



