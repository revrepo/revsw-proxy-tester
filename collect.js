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
/*jshint -W079 */
'use strict';

var logs = require('./models/logs.js'),
  // _ = require('underscore'),
  Promise = require('bluebird'),
  fs = Promise.promisifyAll(require('fs')),
  app_config = require('config'),
  logger = require('revsw-logger')(app_config.get('log_config'));


//  CLI -----------------------------

var showHelp = function() {
  //  here's no place for logger
  console.log('\n  A tools collection to test the functionality of new proxy server versions');
  console.log('  Usage:');
  console.log('    -C :');
  console.log('        Collection mode (default)');
  console.log('    -d, --domain :');
  console.log('        domain name for the collection mode (required)');
  console.log('    -i, --index :');
  console.log('        index name (optional)');
  console.log('    --min-count :');
  console.log('        least amount of hits for every combination of port+uri+method+agent+referer');
  console.log('    -o, --out :');
  console.log('        file name to store output, "[domain].json" is default');
  console.log('    -D, --domain-list :');
  console.log('        Domains list mode, for the given (optional) index');
  console.log('    -I, --indices-list :');
  console.log('        indices List mode');
  console.log('    -H, --health (cluster(default) | indices | shards) :');
  console.log('        Cluster Health mode');
  console.log('    -v, --verbose :');
  console.log('        (guess)');
  console.log('\n  CAUTION:');
  console.log('        Collection mode puts a heavy load on ES cluster, run it against one index,');
  console.log('        avoid using broad index filters like logstash-* !');
  console.log('\n  "NODE_ENV=production" should be inserted before "node collect ..." to run it against the production cluster\n');
};

var conf = {},
  pars = process.argv.slice(2),
  parslen = pars.length,
  curr_par = false,
  action = 'collect';

if (parslen === 0) {
  showHelp();
  return;
}

for (var i = 0; i < parslen; ++i) {

  if (pars[i] === '-h' || pars[i] === '--help') {
    showHelp();
    return;
  }

  if (curr_par) {
    conf[curr_par] = pars[i];
    curr_par = false;
  } else if (pars[i] === '-d' || pars[i] === '--domain') {
    curr_par = 'domain';
  } else if (pars[i] === '-i' || pars[i] === '--index') {
    curr_par = 'index';
  } else if (pars[i] === '-v' || pars[i] === '--verbose') {
    conf.verbose = true;
  } else if (pars[i] === '-o' || pars[i] === '--out') {
    curr_par = 'file';
  } else if (pars[i] === '--min-count') {
    curr_par = 'minCount';
  } else if (pars[i] === '-D' || pars[i] === '--domains-list') {
    action = 'domains';
  } else if (pars[i] === '-C') {
    action = 'collect';
  } else if (pars[i] === '-I' || pars[i] === '--indices-list') {
    action = 'indices';
  } else if (pars[i] === '-H' || pars[i] === '--health') {
    action = 'health';
    curr_par = 'level';
  } else {
    logger.error('\n    unknown parameter: ' + pars[i]);
    showHelp();
    return;
  }
}

//  actions --------------------------------------------------------------------------------------//

if (action === 'collect') {

  if (!conf.domain) {
    logger.error('\n    domain name required.');
    showHelp();
    return;
  }

  if (!conf.file) {
    conf.file = conf.domain;
  }

  logs.aggregateTopRequests(conf)
    .then(function(res) {
      var size = res.length;
      fs.writeFileAsync(conf.file + '.json', JSON.stringify(res, null, 2), 'utf8');
      logger.info('done, ' + size + ' records saved.');
    });

  return;
}

//  ---------------------------------
if (action === 'health') {

  logs.health(conf)
    .then(function(res) {
      logger.info('Cluster health status:\n', res);
    });

  return;
}

//  ---------------------------------
if (action === 'domains') {

  logs.domainsList(conf)
    .then(function(res) {
      logger.info('Domains list:', res);
    });

  return;
}

//  ---------------------------------
if (action === 'indices') {

  logs.indicesList(conf)
    .then(function(res) {
      logger.info('Indices list:\n', res);
    });

  return;
}

//  ----------------------------------------------------------------------------------------------//
