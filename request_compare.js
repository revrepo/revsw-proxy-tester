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

//  ---------------------------------
var reqs = require('./models/requests.js'),
  promise = require('bluebird'),
  fs = promise.promisifyAll(require('fs')),
  app_config = require('config'),
  logger = require('revsw-logger')(app_config.get('log_config'));

//  CLI -----------------------------

var showHelp = function() {
  console.log('\n  A tools collection to test the functionality of new proxy server versions');
  console.log('  Usage:');
  console.log('    -C :');
  console.log('        RequestCompare mode, default');
  console.log('    -i, --input :');
  console.log('        file name to get data from, required for the RequestCompare mode, assuming json');
  console.log('    --prod-proxy :');
  console.log('        production BP server (lga02-bp01.revsw.net is default)');
  console.log('    --test-proxy :');
  console.log('        test BP server (lga02-bp02.revsw.net is default)');
  console.log('    --passed-ratio :');
  console.log('        passed/fired ratio to treat result as successful, percents, default is 95');
  console.log('    -T, --test <URL>:');
  console.log('        Test mode - send 2x2 requests via proxies, show headers and comparison error');
  console.log('    -m, --method <method>:');
  console.log('        HTTP method for the Test mode, GET/POST/HEAD etc');
  console.log('    -v, --verbose :');
  console.log('        blabbing output, shown requests firings\n');
};

var conf = {},
  pars = process.argv.slice(2),
  parslen = pars.length,
  curr_par = false,
  action = 'rnc';

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
  } else if (pars[i] === '-i' || pars[i] === '--input') {
    curr_par = 'file';
  } else if (pars[i] === '--prod-proxy') {
    curr_par = 'proxy_prod';
  } else if (pars[i] === '--test-proxy') {
    curr_par = 'proxy_test';
  } else if (pars[i] === '--passed-ratio') {
    curr_par = 'passed_ratio';
  } else if (pars[i] === '-m' || pars[i] === '--method') {
    curr_par = 'method';
  } else if (pars[i] === '-v' || pars[i] === '--verbose') {
    conf.verbose = true;
  } else if (pars[i] === '-C') {
    action = 'rnc';
  } else if (pars[i] === '-T' || pars[i] === '--test') {
    action = 'test';
    curr_par = 'url';
  } else {
    logger.error('\n    unknown parameter: ' + pars[i]);
    showHelp();
    return;
  }
}

//  ----------------------------------------------------------------------------------------------//

var ratio = 0,
  took;

if ( action === 'rnc' ) {

  if (!conf.file) {
    logger.error('\n    input file name required.');
    showHelp();
    return;
  }

  fs.readFileAsync(conf.file)
    .then(JSON.parse)
    .then(function(requests) {
      logger.info(requests.length + ' logged requests loaded. fired ...');
      took = Date.now();
      return reqs.fire(requests, conf);
    })
    .then(function(responses) {

      var diffs = reqs.compare(responses);
      var len = diffs.total;
      diffs = diffs.diffs;

      ratio = 100 * (len - diffs.length) / len;
      took = ( ( Date.now() - took ) / 1000 ).toFixed(2);

      logger.info(len + ' responses processed, in ' + took + 's');
      logger.info(diffs.length + ' failure comparisons');
      logger.info(ratio.toFixed(2) + ' passed ratio');

      if (diffs.length) {
        logger.warn('diffs are being saved to ' + conf.file + '.diff.json');
        return fs.writeFileAsync(conf.file + '.diff.json', JSON.stringify(diffs, null, 2));
      }
    })
    .then(function() {

      if (ratio < (conf.passed_ratio || 95)) {
        process.exit(1);
      }
      process.exit(0);
    })
    .error(function(err) {
      logger.error('shit happens', err);
      process.exit(255);
    });

  return;
}

if ( action === 'test' ) {

  if ( !conf.url ) {
    logger.error('\n    URL required for the test mode.');
    showHelp();
    return;
  }

  took = Date.now();
  reqs.fire1( conf.url, conf )
    .then( function( data ) {
      logger.warn( data );

    })


}

