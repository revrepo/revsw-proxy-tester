
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

console.log( 'started ...' );

logs.collectTopRequests({
    index: 'logstash-2015.10.08',
    domains: [
        // 'www.mbeans.com',
        'res.mccont.com',
        // 'portal-qa-domain.revsw.net',
        // 'www.metacafe.com',
        // 'quic-test.revsw.net',
        // 'www.google-test.com',
        // 'www3.metacafe.com',
        // 'portal-qa-domain.revsw.net'
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



// { took: 3311,
//   timed_out: false,
//   _shards: { total: 5, successful: 5, failed: 0 },
//   hits: { total: 80666385, max_score: 0, hits: [] },
//   aggregations:
//    { group_by_domain:
//       { doc_count_error_upper_bound: 0,
//         sum_other_doc_count: 0,
//         buckets:
//          [ { key: 'www.metacafe.com', doc_count: 19294485 },
//            { key: 's4.mcstatic.com', doc_count: 8972952 },
//            { key: 's3.mcstatic.com', doc_count: 8835350 },
//            { key: 's6.mcstatic.com', doc_count: 8575857 },
//            { key: 's.mcstatic.com', doc_count: 7337611 },
//            { key: 's1.mcstatic.com', doc_count: 6815276 },
//            { key: 'res.mccont.com', doc_count: 4458636 },
//            { key: 'cedexis-radar.revdn.net', doc_count: 2642327 },
//            { key: 'static.treato.com', doc_count: 1524828 },
//            { key: 'pulse-tlv02.revdn.net', doc_count: 882574 },
//            { key: 'rum01.revsw.net', doc_count: 870973 },
//            { key: 'm.jisusaiche.com', doc_count: 825495 },
//            { key: 'pulse-maa02.revdn.net', doc_count: 811178 },
//            { key: 'pulse-mow02.revdn.net', doc_count: 793580 },
//            { key: 'pulse-sin02.revdn.net', doc_count: 756808 },
//            { key: 'pulse-hkg02.revdn.net', doc_count: 705720 },
//            { key: 'pulse-waw02.revdn.net', doc_count: 663415 },
//            { key: 'vl.mccont.com', doc_count: 662713 },
//            { key: 'monitor.revsw.net', doc_count: 573060 },
//            { key: 'pulse-fra02.revdn.net', doc_count: 319692 },
//            { key: 'pulse-tyo02.revdn.net', doc_count: 316325 },
//            { key: 'cdn.vmturbo.com', doc_count: 306281 },
//            { key: 'mbeans.com', doc_count: 269498 },
//            { key: 'pulse-par02.revdn.net', doc_count: 255323 },
//            { key: 'pulse-ams02.revdn.net', doc_count: 243792 },
//            { key: 'pulse-mad02.revdn.net', doc_count: 225099 },
//            { key: 'cdn.mbeans2.com', doc_count: 200932 },
//            { key: 'pulse-lon02.revdn.net', doc_count: 187508 },
//            { key: 'pulse-dfw02.revdn.net', doc_count: 185061 },
//            { key: 'pulse-den02.revdn.net', doc_count: 158438 },
//            { key: 'pulse-atl02.revdn.net', doc_count: 157670 },
//            { key: 'pulse-phx02.revdn.net', doc_count: 148594 },
//            { key: 'pulse-lax02.revdn.net', doc_count: 143949 },
//            { key: 'pulse-iad02.revdn.net', doc_count: 138347 },
//            { key: 'pulse-sea02.revdn.net', doc_count: 134436 },
//            { key: 'pulse-sjc02.revdn.net', doc_count: 130567 },
//            { key: 'pulse-ord02.revdn.net', doc_count: 128331 },
//            { key: 'pulse-syd02.revdn.net', doc_count: 119768 },
//            { key: 'pulse-mia02.revdn.net', doc_count: 115646 },
//            { key: 'pulse-yyz02.revdn.net', doc_count: 107471 },
//            { key: 'pulse-lga02.revdn.net', doc_count: 106281 },
//            { key: 'dynamic.revsw.cdn.test.danidin.net', doc_count: 67839 },
//            { key: 'cdn.footankleinstitute.com', doc_count: 65776 },
//            { key: 'revsw.cdn.test.danidin.net', doc_count: 62075 },
//            { key: 'pulse-sao02.revdn.net', doc_count: 47589 },cpu
//            { key: 'nginx-status-monitor.revsw.net', doc_count: 44267 },
//            { key: 'www.victor-gartvich.com', doc_count: 43338 },
//            { key: 'www.revsw.com', doc_count: 43193 },
//            { key: 'www.forgestrategy.com', doc_count: 43034 },
//            { key: 'test.revdn.net', doc_count: 42992 },
//            { key: 'pulse-kna02.revdn.net', doc_count: 42538 },
//            { key: 'www.saqqent.com', doc_count: 18620 },
//            { key: 'assets.virtualsky.com', doc_count: 10261 },
//            { key: 'revsw.com', doc_count: 1435 },
//            { key: 'www.Metacafe.com', doc_count: 1348 },
//            { key: 'www.metacafe.com:80', doc_count: 1344 },
//            { key: 'revsw.mobilews.365scores.com', doc_count: 1270 },
//            { key: 'revtest.mygraphs.com', doc_count: 1267 },
//            { key: 'www.revapm.com', doc_count: 1221 },
//            { key: 'www.thegreatdadsproject.org', doc_count: 1167 },
//            { key: 'www.mbeans.com', doc_count: 1166 } ] } } }


