
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

var logs = app_require( 'models/logs.js' ),
    _ = require( 'underscore' );

logs.collectTopRequests({
    index: 'logstash-*',
    domains: [
        'portal-qa-domain.revsw.net',
    //     'quic-test.revsw.net',
    //     'www.google-test.com',
    //     'www3.metacafe.com',
    //     'portal-qa-domain.revsw.net'
    ],
    file: __dirname + '/data/test.json'
});


//  playground -----------------------------------------------------------------------------------//

// logs.health({
//     timeout: 10000,
//     // level: 'indices'
//     level: 'cluster'
// }).then( function( data ) {
//     console.dir( data, { colors: false, depth: null } );
// });

// logs.domainsList({
//     index: [
//         'logstash-2015.10.08',
//         'logstash-2015.10.07',
//         'logstash-2015.10.06',
//         // 'logstash-2015.08*'
//     ],
//     min_doc_count: 10
// }).then( function( resp ) {
//     console.dir( resp, { colors: false, depth: null } );
// }).error( function( err ) {
//     console.trace( 'elasticsearch error', err );
// });



