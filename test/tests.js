var logs = require( '../models/logs.js' ),
  reqs = require( '../models/requests.js' ),
  expect = require( 'chai' ).expect,
  _ = require( 'underscore' );

//  ----------------------------------------------------------------------------------------------//

( function runTests( logs, reqs, expect, _ ) {

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
          silent: true,
          test_responses: true
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

  describe( 'Request/Compare:', function() {
    this.timeout( 30000 );

    it( 'single request', function( done ) {

      reqs.fire1( 'http://s4.mcstatic.com/2648/CSS/GlobalV175/style.css', {
        method: 'HEAD'
      })
        .then( function( data ) {
          done();
        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'single request, handling timeout', function( done ) {

      reqs.fire1( 'http://s4.mcstatic.com/2648/CSS/GlobalV175/style.css', {
        method: 'HEAD',
        timeout: 100
      })
        .then( function( data ) {
          if ( data === false ) {
            done();
          } else {
            done( 'shit happens' );
            console.log( data );
          }
        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'single request, refusing too big content', function( done ) {

      reqs.fire1( 'http://vl.mccont.com/ItemFiles/[From%20www.metacafe.com]%208313132.22169736.4.mp4?__gda__=1443986863_7cdaf878b23d6b64f1790275eca241f8&&', {
        method: 'GET',
      })
        .then( function( data ) {
          if ( data === false ) {
            done();
          } else {
            done( 'shit happens' );
            console.log( data );
          }
        } )
        .catch( function( err ) {
          done( err );
        } );
    } );

    it( 'multiple requests', function( done ) {

      var requests = [
        {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/newSite/resources/style/fontIcons/fonts/Treato-B2C-icons.ttf?jgnea",
          agent: "Mozilla/5.0 (iPad; CPU OS 8_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12D508 Safari/600.1.4",
          referer: "http://static.treato.com/carlos/2.00.00-6098_patch/newSite/resources/style/fontIcons/style.css",
          count: 252
        }, {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/newSite/resources/images/treato-logo@3x.png",
          agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B466 Safari/600.1.4",
          referer: "http://static.treato.com/carlos/2.00.00-6098_patch/resources/newSite/minify/css/new.general.min.css",
          count: 50
        }, {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/newSite/resources/images/bookmark-btn-sprite_v1@3x.png",
          agent: "Mozilla/5.0 (Linux; Android 5.1.1; SM-G920P Build/LMY47X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.94 Mobile Safari/537.36",
          referer: "http://static.treato.com/carlos/2.00.00-6098_patch/resources/newSite/minify/css/new.general.min.css",
          count: 50
        }, {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/resources/images/favicon/favicon-32x32.png?v=zX6NREkKP8",
          agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/6.2.8 Safari/537.85.17",
          referer: "",
          count: 53
        }, {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/resources/images/favicon/apple-touch-icon-180x180.png?v=zX6NREkKP8",
          agent: "Mozilla/5.0 (Linux; Android 5.0; SAMSUNG SM-G900I Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.1 Chrome/34.0.1847.76 Mobile Safari/537.36",
          referer: "",
          count: 60
        }, {
          domain: "static.treato.com",
          method: "get",
          ipport: "80",
          request: "/carlos/2.00.00-6098_patch/resources/newSite/minify/js/new.general.min.js",
          agent: "Mozilla/5.0 (Linux; U; Android 2.3.5; en-in; HTC_Explorer_A310e Build/GRJ90) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
          referer: "http://treato.com/Cetirizine,Sinarest/?a=s",
          count: 205
        }
      ];

      reqs.fire( requests, {} )
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


  } );

}( logs, reqs, expect, _ ) );


//  ----------------------------------------------------------------------------------------------//

