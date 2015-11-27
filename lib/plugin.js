'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()
const includes = require('./includes')
const sse = require('./sse')

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);

    const adapter = opts.adapter;
    const schemas = {};

    adapterUtils.checkValidAdapter(adapter);

    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });

    const appendLinkedResources = includes(server, adapter, schemas).appendLinkedResources;

    const onRouteRegister = function (schema, createRelationshipsRoutesRead, createRelationshipsRoutesWrite) {
        routeUtils.createOptionsRoute(server, schema)
        if (createRelationshipsRoutesRead) {
            routeUtils.createRelationshipsRoutesRead(server, schema)
        }
        if (createRelationshipsRoutesWrite) {
            routeUtils.createRelationshipsRoutesWrite(server, schema)
        }
        adapter.processSchema(schema)
        schemas[schema.type] = schema
    }

    const get = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.get(schema), {config: schema.config}, {
            handler: (req, reply) => {
                routeUtils.parseComparators(req)
                /*Implicit type for sparse fields*/
                if (_.isString(req.query.fields)) {
                    let fields = req.query.fields;
                    req.query.fields = {};
                    req.query.fields[schema.type] = fields;
                }
                reply(adapter.find(schema.type, req))
            }
        })
    }

    const getById = function (schema) {
        onRouteRegister(schema, true)
        return _.merge(routes.getById(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }

    const getChangesStreaming = function (schema) {
        onRouteRegister(schema)
        return _.merge(routes.getChangesStreaming(schema), {config: schema.config}, {
            handler: sse({
                context: server,
                singleResourceName: schema.type
            })
        })
    }

    const post = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.post(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }

    const patch = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.patch(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }

    const del = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.delete(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.delete(schema.type, req)).code(204)
            }
        })
    }

    server.expose('routes', {
        get: get,
        getById: getById,
        getChangesStreaming: getChangesStreaming,
        post: post,
        patch: patch,
        delete: del
    })

    server.expose('schemas', schemas);

    server.on('response', function (req) {
        if (req.ssePingInterval) {
            clearInterval(req.ssePingInterval)
        }
    })

    server.ext('onPostStop', (server, next) => {
        adapter.disconnect(next)
    })

    server.ext('onRequest', (request, reply) => {
        const match = request.url.pathname.match(/\/([^/]+)\/([^/]+)\/relationships\/([^/?#]+)/)
        if (request.method === 'get' && match) {
            const type = match[1];
            const parentId = match[2];
            const relationshipName = match[3];
            const url = '/' + type + '/' + parentId;
            server.inject({method: 'get', url: url, headers: request.hreaders}, function (res) {
                if (res.statusCode !== 200) {
                    reply(res.result).code(res.statusCode);
                    return
                }
                let result = res.result;
                if (result.data.relationships && result.data.relationships[relationshipName]) {
                    let relationship = result.data.relationships[relationshipName]
                    if (_.isArray(relationship)) {
                        let ids = relationship.map(function (item) {
                            return item.id
                        }).join(',')
                        if (_.isEmpty(ids)) {
                            reply({data: []})
                        } else {
                            let relationshipType = schemas[type].relationships[relationshipName][0].type
                            request.setUrl('/' + relationshipType + '?filter[id]=' + ids)
                            reply.continue();
                        }
                    } else {
                        request.setUrl('/' + relationship.type + '/' + relationship.id)
                        reply.continue();
                    }
                } else {
                    reply({data: null})
                }
            });
        } else {
            reply.continue();
        }
    })

    server.ext('onPreResponse', (request, reply) => {
        function globallySetContentTypeJsonApi(request) {
            request.response = request.response || {}
            request.response.output = request.response.output || {}
            request.response.output.headers = request.response.output.headers || {}
            request.response.output.headers['content-type'] = 'application/vnd.api+json'
        }

        function createJsonApiError(output) {
            let error = {}
            if (!output.statusCode) {
                return {
                    errors: [{
                        status: 500,
                        title: 'Internal Server Error'
                    }]
                }
            }
            if (output.statusCode) {
                error.status = output.statusCode
                if (output.statusCode === 400) {
                    error.message = output.payload && output.payload.message
                    error.validation = output.payload && output.payload.validation
                }
            }
            if (output.payload.error) {
                error.title = output.payload.error
            }
            if (output.payload.message) {
                error.detail = output.payload.message
            }
            if (output.payload.meta) {
                error.meta = output.payload.meta
            }
            return {errors: [error]}
        }

        globallySetContentTypeJsonApi(request)
        const response = request.response
        if (response.isBoom) {
            if (response.output.payload.statusCode >= 500) {
                console.error(response.stack)
            }
            response.output.payload = createJsonApiError(response.output)
            return reply(response)
        }
        Promise.resolve().then(appendLinked)
            .then(mapLinks)
            .then(() => {
                reply.continue();
            })
            .catch(function (error) {
                console.error(error && error.stack || error);
                reply().code(500);
            });

        function appendLinked(){
            if (request.query.include && request.response.source) {
                const type = request.path.match(/^\/([^/]+).*/)[1];
                return appendLinkedResources(request, request.response.source, type, request.query.include.split(','), request.query.fields);
            }
            return request.response.source;
        }

        function mapLinks(body) {
            if (!body) return;
            if (_.isArray(body.data)) return body.data.map(createResourceLinks);
            return createResourceLinks(body.data);
        }

        function createResourceLinks(resource) {
            if (!resource || !resource.relationships) return resource;
            const baseUri = server.info.uri;
            resource.relationships = _.forOwn(resource.relationships, function(contents, name) {
                if (!contents) return;
                if (_.isArray(contents)) _.map(contents, createRelated);
                else createRelated(contents);
                resource.relationships[name] = contents;

                function createRelated(doc) {
                    const link = [baseUri, resource.type, resource.id, doc.type, doc.id].join('/');
                    _.set(doc, 'links.related', link);
                }
            });
            return resource;
        }

    });

}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
