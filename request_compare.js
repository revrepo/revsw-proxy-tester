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
  glob = promise.promisify(require( 'glob' )),
  app_config = require('config'),
  logger = require('revsw-logger')(app_config.get('log_config'));


//  CLI -----------------------------

var showHelp = function() {
  console.log('\n  A tools collection to test the functionality of new proxy server versions');
  console.log('  Usage:');
  console.log('    -C :');
  console.log('        RequestCompare mode, default');
  console.log('    -i, --input :');
  console.log('        file name(glob is ok, but enclose it in quotes) to get data from');
  console.log('        required for the RequestCompare mode, assuming json format');
  console.log('    -o, --out :');
  console.log('        file name to save failed results if any, optional, ISO date string used if omitted');
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
  } else if (pars[i] === '-o' || pars[i] === '--out') {
    curr_par = 'output';
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

//  "process.exit(...)" below is a courtesy to a node v0.10 in ubuntu 14 (fuck, yeah) and/or to Jenkins

var ratio = 0,
  took;

if ( action === 'rnc' ) {

  if (!conf.file) {
    logger.error('\n    input file name/glob required.');
    showHelp();
    process.exit(0);
    return;
  }

  glob( conf.file )
    .then( function( files ) {
      // console.log( files );
      return promise.map( files, function( file ) {
        return fs.readFileAsync( file )
          .then( function( data ) {
            logger.info( file + ' loaded' );
            return data;
          })
          .then( JSON.parse )
          .catch( SyntaxError, function( e ) {
            e.fileName = file;
            throw e;
          });
      });
    })
    .then( function( requests_arrays ) {
      var requests = Array.prototype.concat.apply( [], requests_arrays );
      logger.info(requests.length + ' total requests loaded. fired ...');
      took = Date.now();
      return reqs.fire(requests, conf);
    })
    .then(function(responses) {

      var diffs = reqs.compare(responses),
        len = diffs.total,
        errors = diffs.errors;

      diffs = diffs.diffs;
      ratio = 100 * (len - diffs.length) / len;
      took = ( ( Date.now() - took ) / 1000 ).toFixed(2);

      logger.info(len + ' responses processed, in ' + took + 's');
      logger.info(diffs.length + ' failure comparisons');
      logger.info(ratio.toFixed(2) + ' passed ratio');

      if (diffs.length) {
        logger.warn('errors: ', errors);
        if ( !conf.output ) {
          conf.output = (new Date()).toISOString().substr(0,16).replace(/(\:|T)/g,'-') + '.diff.json';
        }
        logger.warn('diffs are being saved to ' + conf.output );
        return fs.writeFileAsync(conf.output, JSON.stringify(diffs, null, 2));
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
    process.exit(0);
    return;
  }

  took = Date.now();
  reqs.fire1( conf.url, conf )
    .then( function( data ) {
      logger.info( data );
      process.exit(0);
    });

}

