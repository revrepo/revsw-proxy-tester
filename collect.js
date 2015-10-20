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

var logs = require('./models/logs.js'),
  promise = require('bluebird'),
  fs = promise.promisifyAll(require('fs')),
  app_config = require('config'),
  logger = require('revsw-logger')(app_config.get('log_config'));


//  CLI -----------------------------

var showHelp = function() {
  //  here's no place for logger
  console.log('\n  A tools collection to test the functionality of new proxy server versions');
  console.log('  Usage:');
  console.log('    -C :');
  console.log('        Collection mode (default)');
  console.log('    -i, --index :');
  console.log('        index name (optional)');
  console.log('    -d, --domain :');
  console.log('        domain name or names(space delimited) for the collection mode (required);');
  console.log('        a sign "@" at the name start denotes json file with an array with domain names');
  console.log('    --min-count :');
  console.log('        least amount of hits for every combination of port+uri+method+agent+referer');
  console.log('    --data-dir :');
  console.log('        path to store collected data, default is . ');
  console.log('    -D, --domain-list :');
  console.log('        Domains list mode, for the given (optional) index');
  console.log('    -I, --indices-list :');
  console.log('        indices List mode');
  console.log('    -H, --health (cluster(default) | indices | shards) :');
  console.log('        Cluster Health mode');
  console.log('    -v, --verbose :');
  console.log('        blabbing output');
  console.log('    --silent :');
  console.log('        only errors');
  console.log('\n  CAUTION:');
  console.log('        Collection mode puts a heavy load on ES cluster, run it against one index,');
  console.log('        avoid using broad index filters like logstash-* !');
  console.log('\n  "NODE_ENV=production" should be inserted before "node collect ..."');
  console.log('  to run it against the production cluster\n');
};

var conf = {
    domain: []
  },
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

  if ( curr_par && pars[i].substr( 0, 1 ) === '-' ) {
    curr_par = false;
  }

  if (pars[i] === '-d' || pars[i] === '--domain') {
    curr_par = 'domain';
  } else if (pars[i] === '-i' || pars[i] === '--index') {
    curr_par = 'index';
  } else if (pars[i] === '-v' || pars[i] === '--verbose') {
    conf.verbose = true;
  } else if (pars[i] === '--data-dir') {
    curr_par = 'path';
  } else if (pars[i] === '--min-count') {
    curr_par = 'minCount';
  } else if (pars[i] === '-D' || pars[i] === '--domains-list') {
    action = 'domains';
  } else if (pars[i] === '-C') {
    action = 'collect';
  } else if (pars[i] === '-I' || pars[i] === '--indices-list') {
    action = 'indices';
    curr_par = 'index';
  } else if (pars[i] === '-H' || pars[i] === '--health') {
    action = 'health';
    curr_par = 'level';
  } else if (curr_par) {
    if ( curr_par === 'domain' ) {
      conf.domain.push( pars[i] );
    } else {
      conf[curr_par] = pars[i];
    }
  } else {
    logger.error('\n    unknown parameter: ' + pars[i]);
    showHelp();
    return;
  }
}

//  actions --------------------------------------------------------------------------------------//

//  "process.exit(...)" below is a courtesy to a node v0.10 in ubuntu 14 (fuck, yeah)

if (action === 'collect') {

  if ( conf.domain.length === 0 ) {
    logger.error('\n    domain name(s) required.');
    showHelp();
    process.exit(0);
    return;
  }

  conf.path = conf.path || './';
  if ( conf.path.substr( -1 ) !== '/' ) {
    conf.path += '/';
  }

  if ( conf.domain[0].substr( 0, 1 ) === '@' ) {
    fs.readFileAsync( conf.domain[0].substr(1), 'utf8' )
      .then( JSON.parse )
      .then( function( data ) {
        logger.info( data.length + ' domain names loaded ...' );
        conf.domain = data;
        return logs.aggregateTopRequests( conf );
      }).then(function() {
        process.exit(0);
      })
      .catch( function( err ) {
        logger.error( 'Collect mode error: ', err );
        process.exit(1);
      });
  } else {
    logs.aggregateTopRequests( conf )
      .then(function() {
        process.exit(0);
      })
      .catch( function( err ) {
        logger.error( 'Collect mode error: ', err );
        process.exit(1);
      });
  }

  return;
}

//  ---------------------------------
if (action === 'health') {

  logs.health(conf)
    .then(function(res) {
      logger.info('Cluster health status:\n', res);
      process.exit(0);
    });

  return;
}

//  ---------------------------------
if (action === 'domains') {

  logs.domainsList(conf)
    .then(function(res) {
      logger.info('Domains list:', res);
      process.exit(0);
    });

  return;
}

//  ---------------------------------
if (action === 'indices') {

  logs.indicesList(conf)
    .then(function(res) {
      logger.info('Indices list:\n', res);
      process.exit(0);
    });

  return;
}

//  ----------------------------------------------------------------------------------------------//
