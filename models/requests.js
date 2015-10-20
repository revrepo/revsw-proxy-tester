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
/*jshint -W054 */

var _ = require( 'underscore' ),
  promise = require( 'bluebird' ),
  req = promise.promisify( require( 'request' ) ),
  app_config = require( 'config' ),
  logger = require( 'revsw-logger' )( app_config.get( 'log_config' ) );

var defaults = app_config.get( 'defaults' ),
  proxies = app_config.get( 'proxies' );

//  ----------------------------------------------------------------------------------------------//
var cached_req_array,
  cached_opts,
  cached_count;

//  ---------------------------------
//  build new request options
//  assumin input data has the following form {
//     "referer": "",
//     "domain": "s.mcstatic.com",
//     "method": "get",
//     "ipport": "80",
//     "agent": "Opera/9.80 (J2ME/MIDP; Opera Mini/8.0.35676/37.6711; U; en) Presto/2.12.423 Version/12.16",
//     "request": "/Images/favicon.ico",
//     "count": 418
// }
var buildReq = function( data ) {
  return {
    url: ( data.ipport === '443' ? 'https://' : 'http://' ) + data.domain + data.request,
    method: data.method.toUpperCase(),
    tunnel: false,
    headers: {
      'User-Agent': data.agent,
      'Referer': data.referer
    },
    followRedirect: false,
    timeout: 15000
  };
};

//  ---------------------------------
//  fire 2 by 2 requests via proxies and return promise with results
//  in case of GET requests, first run HEAD then check content size against [defaults.tooBigContent]
//  returned promise is neve rejected, in case of troubles it resolved with false
var fire_four_ = function( opts ) {

  var resolve,
    deferred = new promise( function( yes /*, reject*/ ) {
      resolve = yes;
    });

  var responses = {
    request: opts.request,
    domain: opts.domain
  };
  opts = opts.request;
  var fires = [ _.clone( opts ), _.clone( opts )];
  fires[0].proxy = cached_opts.proxy_prod;
  fires[1].proxy = cached_opts.proxy_test;

  var run_seq,
    seq = new promise( function( run /*, reject*/ ) {
      run_seq = run;
    });

  seq
    .then( function() {
      return promise.delay( defaults.requestsDelay );
    })
    .then( function() {

      logger.verbose( 'fired ' + opts.method + ':' + opts.url );
      var fired = fires.map( function( request ) {
        return req( request );
      });
      return promise.all( fired );
    })
    .then( function( resp ) {

      responses.headers_prod_1st = resp[0][0].headers;
      responses.headers_test_1st = resp[1][0].headers;

      //  same requests again
      var fired = fires.map( function( request ) {
        return req( request );
      });
      return promise.all( fired );
    })
    .then( function( resp ) {

      responses.headers_prod = resp[0][0].headers;
      responses.headers_test = resp[1][0].headers;

      logger.verbose( ' completed ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
      resolve( responses );
    })
    .catch( function( e ) {
      logger.verbose( ' * nope, error ' + ( e.message ? e.message : '' ) + ': ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
      resolve( false );
      return true;
    });

  if ( opts.method === 'GET' ) {
    //  first check the size of content, send HEAD instead of GET
    promise.resolve( true )
      .then( function() {
        opts.method = 'HEAD';
        return req( opts );
      })
      .then( function( resp ) {
        opts.method = 'GET';

        //  then check the [content-length] header
        if ( resp[0].headers[ 'content-length' ] === undefined ) {
          if ( resp[0].headers[ 'content-type' ] !== undefined && resp[0].headers[ 'content-type' ].substr( 0, 5 ) === 'video' ) {
            logger.verbose( ' - cancel, content is video with undefined length: ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
            resolve( false );
            return false;
          }
        } else {
          if ( parseInt( resp[0].headers[ 'content-length' ] ) > defaults.tooBigContent ) {
            logger.verbose( ' - cancel, too big content length: ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
            resolve( false );
            return false;
          }
        }
        run_seq();
        return true;
      })
      .catch( function( e ) {
        logger.verbose( ' * error ' + ( e.message ? e.message : '' ) + ': ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
        resolve( false );
        return true;
      });

  } else {
    run_seq();
  }

  return deferred;
};

//  ---------------------------------
//  fire requests in parallel with concurrency 64 via production and test proxies
exports.fire = function( req_array, opts ) {

  opts = opts || {};
  opts.proxy_prod = opts.proxy_prod || proxies.production;
  opts.proxy_test = opts.proxy_test || proxies.testing;
  cached_opts = opts;
  if ( opts.verbose ) {
    logger.transports.console.level = 'verbose';
  }

  //  shuffle requests array to avoid/relax domain requests bombing
  var req_array_len = req_array.length;
  while ( req_array_len ) {
      req_array.push( req_array.splice( Math.floor( Math.random() * --req_array_len ), 1 )[0] );
  }

  cached_count = req_array.length;
  cached_req_array = [];
  for ( var i = 0; i < cached_count; ++i ) {
    cached_req_array.push({
      request: buildReq( req_array[i] ),
      domain: req_array[i].domain
    });
  }

  return promise.map( cached_req_array, fire_four_, { concurrency: defaults.requestsConcurrency } )
    .catch( function( err ) {
      logger.error( 'requests model, fire(...), error:', err );
    });
};


//  ----------------------------------------------------------------------------------------------//

//  MAIN function here - gets 2 header structs and makes decision whether they are (almost) equal

//  the datas to compare have the following struct: {
//     server: 'nginx',
//     date: 'Sun, 11 Oct 2015 23:01:17 GMT',
//     'content-type': 'image/png',
//     'content-length': '14666',
//     connection: 'close',
//     etag: '"283c8-394a-4efdf6456d3c0"',
//     'last-modified': 'Mon, 13 Jan 2014 19:50:47 GMT',
//     'cache-control': 'public, max-age=6048000',
//     'x-rev-beresp-ttl': '6048000.000',
//     'x-rev-beresp-grace': '10.000',
//     'x-rev-host': 's.mcstatic.com',
//     'x-rev-url': '/Images/Global/HeaderMatrix-15.png',
//     'x-rev-id': '42605063 43487821',
//     age: '2714',
//     via: '1.1 rev-cache',
//     'x-rev-cache': 'HIT',
//     'x-rev-cache-hits': '2',
//     'x-rev-obj-ttl': '6045286.239',
//     'x-rev-cache-be-1st-byte-time': '0',
//     'x-rev-be-1st-byte-time': '0',
//     'x-rev-cache-total-time': '0',
//     'accept-ranges': 'bytes'
// }

var build_comparators_ = function() {

  var comparators = app_config.get( 'comparators' );
  //  node-config return frozen objects
  //  it's quite stupid, slow but working workaround
  comparators = JSON.parse( JSON.stringify( comparators ) );

  var def_comparator = function( prod, test ) {
    return prod === test;
  };

  _.each( comparators, function( item ) {
    _.each( item, function( key ) {
      if ( !key ) {
        return;
      }
      if ( key.comparator ) {
        key.comparator = new Function( 'prod, test', key.comparator );
      } else {
        key.comparator = def_comparator;
      }
    });
  });

  _.each( comparators, function( item ) {
    if ( item !== comparators.default ) {
      _.defaults( item, comparators.default );
    }
  });

  //
  return function( prod, test, domain ) {
    var curr = comparators[domain] ? comparators[domain] : comparators.default;
    for ( var key in curr ) {

      if ( curr[key] === false ) {
        //  command to not check
        continue;
      }

      if ( test[key] === undefined && prod[key] === undefined ) {
        //  key is not presented in both datasets - nothing to do
        continue;
      }

      if ( test[key] !== undefined && prod[key] !== undefined ) {
        if ( curr[key].comparator( prod[key], test[key] ) ) {
          continue;
        } else {
          //  comparator failed
          return key;
        }
      }

      //  difference in the key existence
      return key + ' existence';
    }
    return '';
  };
};


//  ---------------------------------
//  compare received prod/test responses and returns array with differences
exports.compare = function( response ) {

  // logger.warn( response );

  response = _.filter( response, function( item ) {
    return !!item;
  });

  var count = response.length,
    errors = {},
    compare_ = build_comparators_();

  response = _.filter( response, function( item ) {

    item.error = compare_( item.headers_prod, item.headers_test, item.domain );

    if ( item.error !== '' ) {
      if ( !errors[item.error] ) {
        errors[item.error] = 0;
      }
      ++errors[item.error];
      return true;
    }

    return false;
  });

  return {
    diffs: response,
    total: count,
    errors: errors
  };
};

//  ----------------------------------------------------------------------------------------------//

//  fire ONE request via production and test proxies
exports.fire1 = function( url, opts ) {

  opts = opts || {};
  opts.proxy_prod = opts.proxy_prod || proxies.production;
  opts.proxy_test = opts.proxy_test || proxies.testing;
  opts.method = ( opts.method || 'GET' ).toUpperCase();
  opts.timeout = opts.timeout || 15000; //  for testing
  cached_opts = opts;
  if ( opts.verbose ) {
    logger.transports.console.level = 'verbose';
  }

  var domain = (/(http\:\/\/|https\:\/\/){0,1}([\S\.]+?)(\/|$)/).exec( url );
  domain = ( domain && domain[2] ) ? domain[2] : '-';
  var compare_ = build_comparators_();

  cached_count = 1;
  return fire_four_({
    request:  {
      url: url,
      method: opts.method,
      tunnel: false,
      headers: {},
      followRedirect: false,
      timeout: opts.timeout
    },
    domain: domain
  })
    .then( function( resp ) {

      if ( !resp.headers_prod || !resp.headers_test ) {
        return false;
      }
      resp.error = compare_( resp.headers_prod, resp.headers_test, domain );
      return resp;
    })
    .catch( function( err ) {
      logger.error( 'requests model, fire(...), error:', err );
    });
};


