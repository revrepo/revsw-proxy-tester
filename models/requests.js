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
    timeout: 15000
  };
};

//  ---------------------------------
//  fire 2 by 2 requests via proxies and return promise with results
//  in case of GET requests, first run HEAD then check content size against [defaults.tooBigContent]
//  returned promise is neve rejected, in case of troubles it resolved with false
var fire_four_ = function( opts ) {

  var resolve,
    deferred = new promise( function( rslv /*, reject*/ ) {
      resolve = rslv;
    });

  var responses = { request: opts },
    fires = [ _.clone( opts ), _.clone( opts )];
  fires[0].proxy = cached_opts.proxy_prod;
  fires[1].proxy = cached_opts.proxy_test;

  var inner = promise.resolve( true );

  if ( opts.method === 'GET' ) {
    //  first check the size of content, send HEAD instead of GET
    inner
      .then( function() {
        opts.method = 'HEAD';
        return req( opts );
      })
      .then( function( resp ) {
        opts.method = 'GET';

        //  then check the [content-length] header
        if ( resp[0].headers[ 'content-length' ] === undefined ||
             parseInt( resp[0].headers[ 'content-length' ] ) > defaults.tooBigContent ) {

          // logger.warn( resp[0].headers );

          logger.verbose( ' - too big or undefined content length: ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
          resolve( false );
          return false;
        }
        return true;
      })
      .then( function( resp ) {
        if ( !resp ) {
          // fall through
          return false;
        }

        logger.verbose( 'fired ' + opts.method + ':' + opts.url );
        var fired = fires.map( function( request ) {
          return req( request );
        });
        return promise.all( fired );
      })
      .then( function( resp ) {
        if ( !resp ) {
          // fall through
          return false;
        }

        responses.headers_prod_1st = resp[0][0].headers;
        responses.headers_test_1st = resp[1][0].headers;

        //  same requests again
        var fired = fires.map( function( request ) {
          return req( request );
        });
        return promise.all( fired );
      })
      .then( function( resp ) {
        if ( !resp ) {
          return false;
        }

        responses.headers_prod = resp[0][0].headers;
        responses.headers_test = resp[1][0].headers;

        logger.verbose( ' completed ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
        resolve( responses );
      })
      .catch( function( e ) {
        logger.verbose( ' * error ' + ( e.message ? e.message : '' ) + ': ' + opts.method + ':' + opts.url + ' (' + ( --cached_count ) + ')' );
        resolve( false );
        return true;
      });

  } else {

    inner
      .then( function( resp ) {
        if ( !resp ) {
          // fall through
          return false;
        }

        logger.verbose( 'fired ' + opts.method + ':' + opts.url );
        var fired = fires.map( function( request ) {
          return req( request );
        });
        return promise.all( fired );
      })
      .then( function( resp ) {
        if ( !resp ) {
          // fall through
          return false;
        }

        responses.headers_prod_1st = resp[0][0].headers;
        responses.headers_test_1st = resp[1][0].headers;

        //  same requests again
        var fired = fires.map( function( request ) {
          return req( request );
        });
        return promise.all( fired );
      })
      .then( function( resp ) {
        if ( !resp ) {
          return false;
        }

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

  cached_count = req_array.length;
  cached_req_array = [];
  for ( var i = 0, len = req_array.length; i < len; ++i ) {
    cached_req_array.push( buildReq( req_array[ i ] ) );
  }

  return promise.map( cached_req_array, fire_four_, { concurrency: 64 } )
    .catch( function( err ) {
      logger.error( 'requests model, fire(...), error:', err );
    });
};

//  ---------------------------------
//  fire ONE request via production and test proxies
exports.fire1 = function( url, opts ) {

  opts = opts || {};
  opts.proxy_prod = opts.proxy_prod || proxies.production;
  opts.proxy_test = opts.proxy_test || proxies.testing;
  opts.method = opts.method || 'GET';
  opts.method.toUpperCase();
  cached_opts = opts;
  if ( opts.verbose ) {
    logger.transports.console.level = 'verbose';
  }

  cached_count = 1;
  return fire_four_({
    url: url,
    method: opts.method,
    tunnel: false,
    headers: {},
    timeout: 15000
  })
    .then( function( resp ) {

      if ( !resp.headers_prod || !resp.headers_test ) {
        return false;
      }
      resp.error = compare_( resp.headers_prod, resp.headers_test );
      return resp;
    })
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
var compare_ = function( prod, test ) {

  // var d_ = ( _.detect( [ 'content-type', 'content-length', 'etag', 'last-modified', 'x-rev-cache' ], function( item ) {
  var d_ = ( _.detect( [ 'content-type', 'content-length', 'last-modified', 'x-rev-cache' ], function( item ) {
    test[ item ] = test[ item ] || '';
    prod[ item ] = prod[ item ] || '';
    return prod[ item ] !== test[ item ];
  } ) ) || '';

  //  check etag for "weakness"
  // if ( d_ === 'etag' && prod.etag.substr( 0, 2 ) === 'W/' && test.etag.substr( 0, 2 ) === 'W/' ) {
  //   d_ = ''; //  ignore weak etags
  // }

  return d_;
};


//  ---------------------------------
//  compare received prod/test responses and returns array with differences
exports.compare = function( response ) {

  // logger.warn( response );

  response = _.filter( response, function( item ) {
    return !!item;
  });
  var count = response.length;
  response = _.filter( response, function( item ) {
    item.error = compare_( item.headers_prod, item.headers_test );
    return item.error !== '';
  });

  return {
    diffs: response,
    total: count
  };
};

