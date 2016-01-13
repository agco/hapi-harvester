'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()
const includes = require('./includes')
const sse = require('./sse')
const Hoek = require('hoek')
const Boom = require('boom')
const debug = require('debug')('hh-plugin')

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);


    var adapter = establishAdapter();

    function establishAdapter() {
        if (!opts.adapter) {
            // if no adapter has been passed in, fallback to a default Mongodb
            // the Mongodb adapter will look for a running database on localhost and DOCKER_HOST port 27017
            debug(`adapter not specified, fallback to default 'mongodb' adapter`)
            return adapterUtils.getStandardAdapter('mongodb')()
        } else {
            adapterUtils.checkValidAdapter(opts.adapter)
            return opts.adapter
        }
    }

    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });

    const schemas = {};

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
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                routeUtils.parseComparators(req)

                const query = req.query
                const filter = query.filter
                const limit = (query.page && query.page.limit) || 1000
                const skip = (query.page && query.page.offset) || 0
                const sort = query.sort

                var fields = extractFields(query, schema);

                reply(adapter.find(schema.type, filter, skip, limit, sort, fields).then((data)=> {
                    return {data: data}
                }))
            }
        })
    }

    const getById = function (schema) {
        onRouteRegister(schema, true)
        return _.merge(routes.getById(schema), {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req.params.id, extractFields(req, schema)).then((found)=> {
                    if (found) {
                        return {data: found}
                    } else {
                        return Boom.notFound()
                    }
                }))
            }
        })
    }

    function extractFields(query, schema) {
        /*Implicit type for sparse fields*/
        if (_.isString(query.fields)) {
            const fieldsImplicit = query.fields;
            query.fields = {};
            query.fields[schema.type] = fieldsImplicit;
        }
        return query.fields && query.fields[schema.type] && query.fields[schema.type].split(',');
    }

    const getChangesStreaming = function (schema) {
        onRouteRegister(schema)
        return _.merge(routes.getChangesStreaming(schema), {
            handler: sse({
                context: server,
                singleResourceName: schema.type
            })
        })
    }

    const post = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req.payload.data).then((data)=> {
                    return {data: data}
                })).code(201)
            }
        })
    }

    const patch = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req.params.id, req.payload.data).then((found)=> {
                    if (found) {
                        return {data: found}
                    } else {
                        return Boom.notFound()
                    }
                }))
            }
        })
    }

    const del = function (schema) {
        onRouteRegister(schema, true, true);
        return _.merge(routes.delete(schema), {
            handler: (req, reply) => {
                reply(adapter.delete(schema.type, req.params.id)).code(204)
            }
        })
    }

    const routehandlers = {
        get: get,
        getById: getById,
        getChangesStreaming: getChangesStreaming,
        post: post,
        patch: patch,
        delete: del
    }

    const allLabels = ['get', 'getById', 'getChangesStreaming', 'post', 'patch', 'delete']

    const all = function (schema) {
        return _.map(allLabels, (routeLabel)=> {
            return routehandlers[routeLabel](schema)
        })
    }

    const pick = function (schema, routeLabels) {
        return _.map(routeLabels, (routeLabel)=> {
            var routehandler = routehandlers[routeLabel];
            Hoek.assert(routehandler, `illegal routeLabel : '${routeLabel}', allowed labels are : ${allLabels.join(', ')}`)
            return routehandler(schema)
        })
    }

    const readonly = function (schema) {
        return _.map(['get', 'getById', 'getChangesStreaming'], (routeLabel)=> {
            return routehandlers[routeLabel](schema)
        })
    }

    const immutable = function (schema) {
        return _.map(['get', 'getById', 'getChangesStreaming', 'post'], (routeLabel)=> {
            return routehandlers[routeLabel](schema)
        })
    }

    server.expose('routes', _.merge(routehandlers, {
        pick: pick,
        all: all,
        immutable: immutable,
        readonly: readonly
    }))

    server.expose('schemas', schemas)

    server.on('response', function (req) {
        if (req.ssePingInterval) {
            clearInterval(req.ssePingInterval)
        }
    })

    server.ext('onPostStop', (server, next) => {
        adapter.disconnect(next)
    })

    server.ext('onRequest', (request, reply) => {
        if (request.method === 'get') {
            const match = request.url.pathname.match(generateRelatedMatchPattern());
            if (match) {
                const type = match[1];
                const parentId = match[2];
                const relationshipName = match[3];

                var schema = schemas[type];
                const isRelationship = _.contains(_.keys(schema.relationships), relationshipName)
                if (isRelationship) {
                    const url = '/' + type + '/' + parentId;
                    server.inject({method: 'get', url: url, headers: request.headers}, function (res) {
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
            } else {
                reply.continue();
            }
        } else {
            reply.continue();
        }
    })

    const generateRelatedMatchPattern = function () {
        const resourcesPattern = _.keys(schemas).join('|')
        const uuidPattern = `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[34][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}`
        return new RegExp(`\/(${resourcesPattern})\/(${uuidPattern})\/([^/?#]+)`)
    };

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

        function appendLinked() {
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
            resource.relationships = _.forOwn(resource.relationships, function (contents, name) {
                if (!contents) return;
                if (_.isArray(contents)) _.map(contents, createRelated);
                else createRelated(contents);
                resource.relationships[name] = contents;

                function createRelated(doc) {
                    const link = [resource.type, resource.id, doc.type].join('/');
                    _.set(doc, 'links.related', `/${link}`);
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
