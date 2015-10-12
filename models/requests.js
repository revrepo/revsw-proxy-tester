
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

var _ = require( 'underscore' ),
    Promise = require( "bluebird" ),
    Req = Promise.promisify( require( "request" ) );

//  ---------------------------------
//  defaults
var req_config = {
    proxy_prod: 'http://lga02-bp01.revsw.net',
    proxy_test: 'http://lga02-bp02.revsw.net',
    allowed_ttl_diff: 10000,
};


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
        }
    }
}

//  ---------------------------------

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

    if ( _.detect( ['content-type', 'content-length', 'etag', 'last-modified', 'x-rev-cache'], function( item ) {
            test[item] = test[item] || '';
            prod[item] = prod[item] || '';
            return prod[item] !== test[item];
         }) !== undefined )
        return false;

    //  this stuff cannot be absolutelly equal, it diffs by a time between two requests
    test['x-rev-obj-ttl'] = parseFloat( test['x-rev-obj-ttl'] || 0 );
    prod['x-rev-obj-ttl'] = parseFloat( prod['x-rev-obj-ttl'] || 0 );
    if ( Math.abs( prod['x-rev-obj-ttl'] - test['x-rev-obj-ttl'] ) > req_config.allowed_ttl_diff )
        return false;

    return true;
}


//  ----------------------------------------------------------------------------------------------//

var cached_req_array;

var fire = exports.fire = function( req_array, pars ) {

    cached_req_array = req_array;
    pars = pars || {};
    fired = [];
    for ( var i = 0, len = req_array.length; i < len; ++i ) {
        var opts = buildReq( req_array[i] );

        //  even requests go through production proxy, odd - via testing
        opts.proxy = pars.proxy_prod || req_config.proxy_prod;
        fired.push( Req( opts ) );
        opts.proxy = pars.proxy_test || req_config.proxy_test;
        fired.push( Req( opts ) );
    }

    return Promise.all( fired )
        .error( function( err ) {
            console.log( 'shit happens' );
            console.dir( err, { colors: false, depth: null } );
        });
}

//  ---------------------------------
var compare = exports.compare = function( response ) {

    var diffs = [];
    for ( var i = 0, len = response.length; i < len; i += 2 ) {
        var headers_prod = response[i][0].headers,  //  response[i][1] <-- repsponse's body
            headers_test = response[i+1][0].headers;

        if ( !compare_( headers_prod, headers_test ) ) {
            diffs.push( {
                req: cached_req_array[i/2],
                headers_prod: headers_prod,
                headers_test: headers_test,
            });
        }
    };

    return diffs;
}


