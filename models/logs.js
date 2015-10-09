
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

var Promise = require( 'bluebird' ),
    app_config = app_require( 'config/app.js' ),
    _ = require( 'underscore' ),
    elastic = require( 'elasticsearch' );

var appendFile = Promise.promisify( require( 'fs' ).appendFile );


//  ---------------------------------
//  create logstash index name for the current date(today): "logstash-2015.10.01"
var last_index = function() {
    return 'logstash-' + ( new Date() ).toISOString().substr( 0, 10 ).replace( /\-/g, '.' );
}

//  ---------------------------------
//  defaults
var config = {
    indices: last_index(),
    topAgents: 50,
    topReferers: 100,
    topURLs: 100,
    aggsCollectMode: 'breadth_first',   //  depth_first/breadth_first, https://www.elastic.co/guide/en/elasticsearch/guide/current/_preventing_combinatorial_explosions.html
};

var client = new elastic.Client( {
    host: app_config.elastic.host,
    apiVestion: app_config.elastic.version,
    log: [{
        type: 'stdio',
        levels: ['error', 'warning']
    }],
    requestTimeout: 90000
} );

//  ----------------------------------------------------------------------------------------------//

var health = exports.health = function( pars ) {

    return client.cluster.health( pars )
        .error( function( err ) {
            console.trace( 'Logs model, health(...), Elasticsearch error:', err );
        });
}

//  ---------------------------------
var domainsList = exports.domainsList = function( pars ) {

    pars = pars || {};

    return client.search({
        index: pars.index || config.indices,
        size: 0,
        body: {
            aggs: {
                group_by_domain: {
                    terms: {
                        field: 'domain.raw',
                        size: pars.size || 100,
                        min_doc_count: pars.min_doc_count || 1000,
                        exclude: '-'
                    },
                },
            },
        }
    }).then( function( resp ) {
        return resp.aggregations.group_by_domain.buckets;
    }).error( function( err ) {
        console.trace( 'Logs model, domainsList(...), Elasticsearch error:', err );
    });
}

//  ---------------------------------
var indicesList = exports.indicesList = function( pars ) {

    pars = pars || {};
    pars.index = pars.index || 'logstash-*';

    return client.cat.indices( pars )
        .error( function( err ) {
            console.trace( 'Logs model, indicesList(...), Elasticsearch error:', err );
        });
}

//  top requests collector -----------------------------------------------------------------------//

//  ---------------------------------
//  convert retrieved complex structure into flat array
var handle_response_ = function( resp ) {

    var current = { referer: '' };
    var flat = [];

    _.each( resp.aggregations.group_by_domain.buckets, function( domain ) {
        current.domain = domain.key;
        _.each( domain.group_by_method.buckets, function( method ) {
            current.method = method.key;
            _.each( method.group_by_port.buckets, function( port ) {
                current.ipport = port.key;
                _.each( port.group_by_agent.buckets, function( agent ) {
                    current.agent = agent.key;

                    if ( agent.group_by_referer ) {
                        _.each( agent.group_by_referer.buckets, function( referer ) {
                            current.referer = referer.key;
                            _.each( referer.group_by_URL.buckets, function( url ) {
                                current.request = url.key;
                                current.count = url.doc_count;
                                flat.push( _.clone( current ) );
                            } );
                        });
                    } else {
                        _.each( agent.group_by_URL.buckets, function( url ) {
                            current.request = url.key;
                            current.count = url.doc_count;
                            flat.push( _.clone( current ) );
                        } );
                    }

                } );
            } );
        } );
    });

    // console.dir( flat, { colors: false, depth: null } );
    return flat;
}

//  ---------------------------------
var store_response_ = function( content, filename ) {

    if ( content.length ) {
        content = JSON.stringify( content );
        content = content.replace( /^\[|\]$/g, '' ) + ',';
        return appendFile( filename, content );
    }
    return Promise.resolve( true );
}

//  ---------------------------------
var collectTopRequests = exports.collectTopRequests = function( pars ) {

    pars = pars || {};
    pars.file = pars.file || __dirname + '/logs.json';

    var inner_query = pars.domains ? {
        terms: {
            'domain.raw': pars.domains
        }
    } : {
        match_all: {}
    };
    var no_ref_filter = {
        missing: {
            field: 'referer'
        }
    };
    var ref_filter = {
        exists: {
            field: 'referer'
        }
    };

    var no_ref_aggs = {
        group_by_URL: {
            terms: {
                field: 'request.raw',
                size: config.topURLs,
                collect_mode: config.aggsCollectMode,
            },
        }
    };
    var ref_aggs = {
        group_by_referer: {
            terms: {
                field: 'referer.raw',
                size: config.topReferers,
                collect_mode: config.aggsCollectMode,
            },
            aggs: no_ref_aggs
        }
    };
    var aggs = {
        group_by_domain: {
            terms: {
                field: 'domain.raw',
                size: 100,
                min_doc_count: 50,
                collect_mode: config.aggsCollectMode,
                exclude: '-'
            },
            aggs: {
                group_by_method: {
                    terms: {
                        field: 'method',
                        size: 10,
                        collect_mode: config.aggsCollectMode,
                    },
                    aggs: {
                        group_by_port: {
                            terms: {
                                field: 'ipport',
                                size: 2,    //  80 | 443
                                collect_mode: config.aggsCollectMode,
                            },
                            aggs: {
                                group_by_agent: {
                                    terms: {
                                        field: 'agent.raw',
                                        size: config.topAgents,
                                        collect_mode: config.aggsCollectMode,
                                    },
                                    aggs: ref_aggs
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    return client.search({

        index: pars.index || config.indices,
        size: 0,
        body: {
            query: {
                filtered: {
                    query: inner_query,
                    filter: ref_filter
                }
            },
            aggs: aggs
        }
    }).then( function( resp ) {

        //  debug
        console.dir( resp, { colors: false, depth: null } );
        //  debug

        var content = handle_response_( resp );
        console.log( 'collectTopRequests: ' + content.length + ' records' );
        return store_response_( content, pars.file );

    }).then( function() {

        aggs.group_by_domain.aggs.group_by_method.aggs.group_by_port.aggs.group_by_agent.aggs = no_ref_aggs;
        return client.search({

            index: pars.index || config.indices,
            size: 0,
            body: {
                query: {
                    filtered: {
                        query: inner_query,
                        filter: no_ref_filter
                    }
                },
                aggs: aggs
            }
        });
    }).then( function( resp ) {

        //  debug
        console.dir( resp, { colors: false, depth: null } );
        //  debug

        var content = handle_response_( resp );
        console.log( 'collectTopRequests: ' + content.length + ' records' );
        return store_response_( content, pars.file );

    }).error( function( err ) {
        console.trace( 'Logs model, collectTopRequests(...), Elasticsearch error:', err );
    });
}



