var logs = require( '../models/logs.js' ),
  expect = require( 'chai' ).expect,
  _ = require( 'underscore' );

//  ----------------------------------------------------------------------------------------------//

( function runTests( logs, expect, _ ) {

  describe( 'Logs:', function() {
    this.timeout( 60000 );

    it( 'get claster\'s health status', function( done ) {

      logs.health()
        .then( function( data ) {
          //  data.cluster_name === 'test_elasticsearch'
          done();
        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'get claster\'s indices list', function( done ) {

      logs.indicesList()
        .then( function( data ) {
          // console.log( data );
          done();
        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'get domain list for the given index', function( done ) {

      logs.domainsList( {
          index: 'logstash-2015.10.15',
          minCount: 10
        } )
        .then( function( data ) {
          if ( data.length ) {
            done();
          } else {
            // console.log( data );
            // console.log( data.length );
            done( 'empty or wrong format data received' );
          }

        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'aggreagte requests for the given index and domains', function( done ) {

      logs.aggregateTopRequests( {
          domain: [
            'portal-qa-domain.revsw.net',
            'test-proxy-cache-config.revsw.net',
            'www3.metacafe.com'
          ],
          index: 'logstash-2015*',
          minCount: 30,
          silent: true
        } )
        .then( function( data ) {
          // console.log( data );
          if ( data.length ) {
            done();
          } else {
            done( 'empty or wrong format data received' );
          }

        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

  } );

}( logs, expect, _ ) );


//  ----------------------------------------------------------------------------------------------//

