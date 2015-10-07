
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

var fs = require( 'fs' ),
    config = require( 'config' ),
    _ = require( 'underscore' ),
    elastic = require( 'elasticsearch' );

var requests = [];

//  aggregate and process all records with existing "referer" field

var searchWithReferer = function() {
    return client.search({ //  first search with existing "referer" field
        index:'logstash-*',
        size: 0,
        body: {
            query: {
                filtered: {
                    filter: {
                        exists: {
                            field: 'referer'
                        }
                    }
                }
            },
            aggs: {
                group_by_domain: {
                    terms: {
                        field: 'domain.raw',
                        size: 100,
                        min_doc_count: 50,
                        exclude: '-'
                    },
                    aggs: {
                        group_by_method: {
                            terms: {
                                field: 'method',
                                size: 10,
                            },
                            aggs: {
                                group_by_port: {
                                    terms: {
                                        field: 'ipport',
                                        size: 2,    //  80 | 443
                                    },
                                    aggs: {
                                        group_by_agent: {
                                            terms: {
                                                field: 'agent.raw',
                                                size: 50,
                                            },
                                            aggs: {
                                                group_by_referer: {
                                                    terms: {
                                                        field: 'referer.raw',
                                                        size: 100,
                                                    },
                                                    aggs: {
                                                        group_by_URL: {
                                                            terms: {
                                                                field: 'request.raw',
                                                                size: 100,
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                        }
                                    },
                                }
                            },
                        }
                    },
                },
            },
        }

    });
}

var processWithReferer = function( data ) {

    var current = {};

    _.each( data.aggregations.group_by_domain.buckets, function( domain ) {
        current.domain = domain.key;
        // console.log( current.domain );
        _.each( domain.group_by_method.buckets, function( method ) {
            current.method = method.key;
            _.each( method.group_by_port.buckets, function( port ) {
                current.ipport = port.key;
                _.each( port.group_by_agent.buckets, function( agent ) {
                    current.agent = agent.key;
                    _.each( agent.group_by_referer.buckets, function( referer ) {
                        current.referer = referer.key;
                        _.each( referer.group_by_URL.buckets, function( url ) {
                            current.request = url.key;
                            requests.push( _.clone( current ) );
                        } );
                    } );
                } );
            } );
        } );
    });

    // console.dir( requests, { colors: false, depth: null } );
}

//  aggregate and process all records without "referer" field

var searchWithoutReferer = function() {

    return client.search({
        index:'logstash-*',
        size: 0,
        body: {
            query: {
                filtered: {
                    filter: {
                        missing: {
                            field: 'referer'
                        }
                    }
                }
            },
            aggs: {
                group_by_domain: {
                    terms: {
                        field: 'domain.raw',
                        size: 100,
                        min_doc_count: 50,
                        exclude: '-'
                    },
                    aggs: {
                        group_by_method: {
                            terms: {
                                field: 'method',
                                size: 10,
                            },
                            aggs: {
                                group_by_port: {
                                    terms: {
                                        field: 'ipport',
                                        size: 2,    //  80 | 443
                                    },
                                    aggs: {
                                        group_by_agent: {
                                            terms: {
                                                field: 'agent.raw',
                                                size: 50,
                                            },
                                            aggs: {
                                                group_by_URL: {
                                                    terms: {
                                                        field: 'request.raw',
                                                        size: 100,
                                                    },
                                                }
                                            },
                                        }
                                    },
                                }
                            },
                        }
                    },
                },
            },
        }
    });
}

var processWithoutReferer = function( data ) {

    var current = { referer: '' };

    _.each( data.aggregations.group_by_domain.buckets, function( domain ) {
        current.domain = domain.key;
        console.log( current.domain );
        _.each( domain.group_by_method.buckets, function( method ) {
            current.method = method.key;
            _.each( method.group_by_port.buckets, function( port ) {
                current.ipport = port.key;
                _.each( port.group_by_agent.buckets, function( agent ) {
                    current.agent = agent.key;
                    _.each( agent.group_by_URL.buckets, function( url ) {
                        current.request = url.key;
                        requests.push( _.clone( current ) );
                    } );
                } );
            } );
        } );
    });

    // console.dir( requests, { colors: false, depth: null } );
}

//  ----------------------------------------------------------------------------------------------//

var client = new elastic.Client( {
    host: config.elastic.host,
    apiVestion: config.elastic.host,
    // log: 'trace',
    log: [{
        type: 'stdio',
        levels: ['error', 'warning']
    }]
} );

//  ---------------------------------

searchWithReferer()
    .then( processWithReferer )
    .then( searchWithoutReferer )
    .then( processWithoutReferer )
    .then( function() {
        var content = JSON.stringify( requests );
        fs.writeFileSync( __dirname + '/data/stage-1.json', content );
        console.log( 'done, ' + requests.length + ' records stored' );
    })
    .error( function( err ) {
        console.trace( 'elasticsearch error', err );
    });

