'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()
const includes = require('./includes')
const sse = require('./sse')
const Hoek = require('hoek')
const Boom = require('boom')
const Qs = require('qs')
const Url = require('url')
const debug = require('debug')('hh-plugin')

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);

    const adapters = []

    const adapter = opts.adapter
    adapterUtils.checkValidAdapter(adapter)
    server.expose('adapter', adapter)
    adapters.push(adapter)

    const adapterSSE = opts.adapterSSE
    if (adapterSSE) {
        adapterUtils.checkValidAdapterSSE(adapterSSE)
        server.expose('adapterSSE', adapterSSE)
        adapters.push(adapterSSE)

        server.dependency('susie')
    }

    Promise.all(_.map(adapters, (adapter)=>adapter.connect()))
        .then(()=> {
            
            const schemas = {};

            const appendLinkedResources = includes(server, adapter, schemas).appendLinkedResources;

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
                onRouteRegister(schema)

                var getByIdRoute = _.merge(routes.getById(schema), {
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

                return routeUtils.createRelationshipsRoutesRead(adapter, schema).concat(getByIdRoute)
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
                Hoek.assert(adapterSSE, 'getChangesStreaming can not be invoked, adapterSSE is not set')
                if (schema == null) {
                    return _.merge(routes.getChangesStreaming(schema), {
                        handler: sse({
                            context: server
                        })
                    })
                }
                onRouteRegister(schema)
                return _.merge(routes.getChangesStreaming(schema), {
                    handler: sse({
                        context: server,
                        singleResourceName: schema.type
                    })
                })
            }

            const post = function (schema) {
                onRouteRegister(schema)
                return _.merge(routes.post(schema), {
                    handler: (req, reply) => {
                        reply(adapter.create(schema.type, req.payload.data)
                            .then((data)=> {
                                return {data: data}
                            })
                            .catch((err) => {
                                if (err.code === 11000) throw Boom.conflict(err.errmsg)
                                throw Boom.badImplementation(err)
                            })
                        ).code(201)
                    }
                })
            }

            const patch = function (schema) {
                onRouteRegister(schema)
                const patchRoute = _.merge(routes.patch(schema), {
                    handler: (req, reply) => {
                        reply(adapter.patch(schema.type, req.params.id, req.payload.data).then((found)=> {
                            if (found) {
                                return {data: found}
                            } else {
                                return Boom.notFound()
                            }
                        }))
                    }
                })
                return routeUtils.createRelationshipsRoutesWrite(adapter, schema).concat(patchRoute)
            }

            const del = function (schema) {
                onRouteRegister(schema)
                return _.merge(routes.delete(schema), {
                    handler: (req, reply) => {
                        reply(adapter.delete(schema.type, req.params.id)).code(204)
                    }
                })
            }

            const options = function (schema) {
                onRouteRegister(schema)
                return _.merge(routes.options(schema), {
                    handler: (req, reply) => {
                        const tables = _.map(req.server.table()[0].table, (table) => {
                            return _.pick(table, 'path', 'method')
                        })

                        const pathVerbs = _.chain(tables)
                            .filter((table) => {
                                return table.path.replace('/{id}', '') === req.path
                            })
                            .pluck('method')
                            .map((verb) => {
                                return verb.toUpperCase()
                            })
                            .value();

                        reply().header('Allow', pathVerbs.join(','))
                    }
                })
            }

            const onRouteRegister = function (schema) {
                adapter.processSchema(schema)
                schemas[schema.type] = schema
            }


            const routehandlers = {
                get: get,
                getById: getById,
                getChangesStreaming: getChangesStreaming,
                post: post,
                patch: patch,
                delete: del,
                options: options
            }

            const allLabels = constructLabels()

            function constructLabels() {
                const labels = ['get', 'getById', 'post', 'patch', 'delete', 'options']
                if (adapterSSE) {
                    labels.push('getChangesStreaming')
                }
                return labels
            }

            const all = function (schema) {
                return _.chain(allLabels)
                    .map((routeLabel)=> {
                        return routehandlers[routeLabel](schema)
                    })
                    .flatten()
                    .value()
            }

            const pick = function (schema, routeLabels) {
                return _.chain(routeLabels)
                    .map((routeLabel)=> {
                        var routehandler = routehandlers[routeLabel];
                        Hoek.assert(routehandler, `illegal routeLabel : '${routeLabel}', allowed labels are : ${allLabels.join(', ')}`)
                        return routehandler(schema)
                    })
                    .flatten()
                    .value()
            }

            const readonly = function (schema) {
                return _.chain(['get', 'getById', 'getChangesStreaming', 'options'])
                    .map((routeLabel)=> {
                        return routehandlers[routeLabel](schema)
                    })
                    .flatten()
                    .value()
            }

            const immutable = function (schema) {
                return _.chain(['get', 'getById', 'getChangesStreaming', 'post', 'options'])
                    .map((routeLabel)=> {
                        return routehandlers[routeLabel](schema)
                    })
                    .flatten()
                    .value()
            }

            server.expose('routes', _.merge(routehandlers, {
                pick: pick,
                all: all,
                immutable: immutable,
                readonly: readonly
            }))

            server.expose('schemas', schemas)

            // parse qs style query strings since hapi 12.x doesn't anymore.
            server.ext('onRequest', (request, reply) => {
                const uri = request.raw.req.url
                const parsed = Url.parse(uri, false)
                parsed.query = Qs.parse(parsed.query)
                request.setUrl(parsed)

                return reply.continue()
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
                                if (result.data.relationships && result.data.relationships[relationshipName] && result.data.relationships[relationshipName].data) {
                                    let relationship = result.data.relationships[relationshipName].data
                                    if (_.isArray(relationship)) {
                                        let ids = relationship.map(function (item) {
                                            return item.id
                                        }).join(',')
                                        if (_.isEmpty(ids)) {
                                            reply({data: []})
                                        } else {
                                            let relationshipType = schemas[type].relationships[relationshipName].data[0].type
                                            request.setUrl('/' + relationshipType + '?filter[id]=' + ids)
                                            request.query = Qs.parse('filter[id]=' + ids)
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
                        if (!contents || !contents.data) return;
                        if (_.isArray(contents.data)) _.map(contents.data, createRelated);
                        else createRelated(contents.data);
                        resource.relationships[name] = contents;

                        function createRelated(doc) {
                            const link = [resource.type, resource.id, doc.type].join('/');
                            _.set(contents, 'links.related', `/${link}`);
                        }
                    });
                    return resource;
                }

            })

            server.ext('onPostStop', (server, next) => {
                Promise.all(_.map(adapters, (adapter)=>adapter.disconnect()))
                    .then(()=> {
                        next()
                    })
                    .catch((e)=> {
                        next(e)
                    })
            })

            next()

        })
        .catch((err)=> {
            console.error(err)
            // todo how come below doesn't stop the startup?
            next(err)
        })

}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getAdapter
