
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

//  CLI -----------------------------

var showHelp = function() {
    console.log( '\n  Usage:' );
    console.log( '    -i, --input :' );
    console.log( '        file name to get data from, required, assuming json' );
    console.log( '    --prod-proxy :' );
    console.log( '        production BP server (lga02-bp01.revsw.net is default)' );
    console.log( '    --test-proxy :' );
    console.log( '        test BP server (lga02-bp02.revsw.net is default)' );
    console.log( '    --passed-ratio :' );
    console.log( '        passed/fired ratio to treat result as successful, percents, default is 95\n' );
}

var conf = {},
    pars = process.argv.slice( 2 ),
    parslen = pars.length,
    curr_par = false;

if ( parslen === 0 ) {
    showHelp();
    return;
}

for ( var i = 0; i < parslen; ++i ) {

    if ( pars[i] === '-h' || pars[i] === '--help' ) {
        showHelp();
        return;
    }

    if ( curr_par ) {
        conf[curr_par] = pars[i];
        curr_par = false;
    } else if ( pars[i] === '-i' || pars[i] === '--input' ) {
        curr_par = 'file';
    } else if ( pars[i] === '--prod-proxy' ) {
        curr_par = 'proxy_prod';
    } else if ( pars[i] === '--test-proxy' ) {
        curr_par = 'proxy_test';
    } else if ( pars[i] === '--passed-ratio' ) {
        curr_par = 'passed_ratio';
    } else if ( pars[i] === '-v' || pars[i] === '--verbose' ) {
        conf.verbose = true;
    } else {
        console.error( '\n    unknown parameter: ' + pars[i] );
        showHelp();
        return;
    }
};

//  check ---------------------------

if ( !conf.file ) {
    console.error( '\n    input file name required.' );
    showHelp();
    return;
}


//  ----------------------------------------------------------------------------------------------//

var ratio = 0;

fs.readFileAsync( conf.file )
    .then( JSON.parse )
    .then( function( requests ) {
        console.log( requests.length + ' logged requests loaded. fired ...' );
        return reqs.fire( requests, conf );
    })
    .then( function( responses ) {
        var len = responses.length / 2;
        var diffs = reqs.compare( responses );
        ratio = 100 * ( len - diffs.length ) / len;
        console.log( len + ' responses received' );
        console.log( diffs.length + ' failure comparisons' );
        console.log( ratio.toFixed( 2 ) + ' passed ratio' );
        if ( diffs.length ) {
            console.log( 'diffs are being saved to ' + conf.file + '.diff.json' );
            return fs.writeFileAsync( conf.file + '.diff.json', JSON.stringify( diffs, null, 4 ) );
        }
    })
    .then( function() {

        if (  ratio < ( conf.passed_ratio || 95 ) ) {
            process.exit( 1 );
        }
        process.exit( 0 );
    })
    .error( function( err ) {
        console.log( 'shit happens' );
        console.dir( err, { colors: false, depth: null } );
        process.exit( 255 );
    })