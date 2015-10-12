
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

global.app_require = function ( name ) {
    return require( __dirname + '/' + name );
}

//  ---------------------------------
var reqs = app_require( 'models/requests.js' ),
    _ = require( 'underscore' ),
    Promise = require( 'bluebird' ),
    fs = Promise.promisifyAll( require( 'fs' ) );

//  ----------------------------------------------------------------------------------------------//

console.log( 'long run started ...' );
var file = 'data/s.mcstatic.com.json';

fs.readFileAsync( file )
    .then( JSON.parse )
    .then( function( requests ) {
        console.log( requests.length + ' logged requests loaded' );
        return reqs.fire( requests );
    })
    .then( function( responses ) {
        console.log( responses.length + ' responses received' );
        var diffs = reqs.compare( responses );

        console.log( diffs.length + ' failure comparisons' );
        if ( diffs.length ) {
            return fs.writeFileAsync( file + '.diff.json', JSON.stringify( diffs ) );
        }

    })
    .error( function( err ) {
        console.log( 'shit happens' );
        console.dir( err, { colors: false, depth: null } );
    })
