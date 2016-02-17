'use strict'

const _ = require('lodash')
const Joi = require('joi')
const config = require('./config')
const Pack = require('../package')
const HapiSwagger = require('hapi-swagger')

describe('Swagger docs', function () {

    const schemas = {
        people: {
            type: 'people',
            attributes: {
                name: Joi.string(),
                appearances: Joi.number()
            },
            relationships: {
                pets: {
                    data: [{type: 'pets'}]
                },
                soulmate: {
                    data: {type: 'people'}
                }
            }
        },
        pets: {
            type: 'pets',
            attributes: {
                name: Joi.string()
            },
            relationships: {
                owner: {
                    data: {type: 'people'}
                }
            }
        }
    }

    function createServer() {
        return new Promise(function (resolve) {
            let server
            const Hapi = require('hapi')
            const harvester = require('../')

            const mongodbAdapter = harvester.getAdapter('mongodb')
            const mongodbSSEAdapter = harvester.getAdapter('mongodb/sse')

            const swaggerOptions = {
                info: {
                    title: 'hapi-harvester hapi-swagger testing',
                    version: Pack.version
                },
                jsonPath: '/docs'
            }


            server = new Hapi.Server()
            server.connection({port: 9100})
            server.register([
                {
                    register: require('../'),
                    options: {
                        adapter: mongodbAdapter(config.mongodbUrl),
                        adapterSSE: mongodbSSEAdapter(config.mongodbOplogUrl)
                    }
                },
                require('susie'),
                require('inject-then'),
                require('inert'),
                require('vision'),
                { register: HapiSwagger, options: swaggerOptions }
            ], () => {
                server.start(() => {
                    _.forEach(schemas, function (schema) {
                        [
                            'get',
                            'getById',
                            'getChangesStreaming',
                            'post',
                            'patch',
                            'delete'
                        ].forEach(function (verb) {
                            const route = server.plugins['hapi-harvester'].routes[verb](schema)
                            if (_.isArray(route)) {
                                _.forEach(route, function (route) {
                                    server.route(route)
                                });
                            } else {
                                server.route(route)
                            }
                        })
                    })
                    resolve(server)
                })
            })
        })
    }

    let server

    before(function () {
        return createServer().then(function (result) {
            server = result
        })
    })

    after(function (done) {
        if (server) {
            server.stop(done)
        }
    })

    describe('GET /docs', function () {
        let apis
        before(function () {
            return server.injectThen({method: 'get', url: '/docs'}).then(function (res) {
                apis = res.result.paths
            })
        })
        it('should return a full list of registered paths', function () {
            const allPaths = {}
            // create a collection of unique method+path combinations
            _.forEach(apis, (method, path) => {
                _.forEach(method, (value, key) => {
                    allPaths[key + path] = value
                })
            })
            expect(Object.keys(allPaths)).to.have.length(24)
        })
        // not sure this data exists...
        it.skip('should describe models', function () {
            const models = {
                fields: {
                    id: 'fields',
                    type: 'object',
                    properties: {}
                },
                page: {
                    id: 'page',
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            defaultValue: null,
                            description: undefined,
                            maximum: undefined,
                            minimum: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        offset: {
                            type: 'number',
                            defaultValue: null,
                            description: undefined,
                            maximum: undefined,
                            minimum: undefined,
                            notes: undefined,
                            tags: undefined
                        }
                    }
                },
                filter: {
                    id: 'filter',
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        name: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        appearances: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        pets: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        soulmate: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        }
                    }
                },
                attributes: {
                    id: 'attributes',
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        appearances: {
                            type: 'number',
                            defaultValue: null,
                            description: undefined,
                            maximum: undefined,
                            minimum: undefined,
                            notes: undefined,
                            tags: undefined
                        }
                    }
                },
                relationships: {
                    id: 'relationships',
                    type: 'object',
                    properties: {
                        pets: {
                            type: 'pets',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        },
                        soulmate: {
                            type: 'soulmate',
                            defaultValue: null,
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        }
                    }
                },
                data: {
                    id: 'data',
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            required: true,
                            defaultValue: undefined,
                            description: 'RFC4122 v4 UUID',
                            notes: undefined,
                            tags: undefined
                        },
                        type: {
                            type: 'string',
                            required: true,
                            defaultValue: undefined,
                            enum: ['pets'],
                            description: undefined,
                            notes: undefined,
                            tags: undefined
                        }
                    }
                }
            }
            _.forEach(models, function (item, key) {
                expect(result.models[key]).to.eql(item)
            })
        })
        it('should describe GET /people parameters', function () {
            const api = apis['/people'].get
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('include')
            expect(parameters.include).to.have.property('in', 'query')
            expect(parameters.include).to.have.property('type', 'string')
            expect(parameters).to.have.property('fields')
            expect(parameters.fields).to.have.property('in', 'query')
            expect(parameters.fields).to.have.property('type', 'object')
            expect(parameters).to.have.property('sort')
            expect(parameters.sort).to.have.property('in', 'query')
            expect(parameters.sort).to.have.property('type', 'string')
            expect(parameters).to.have.property('page')
            expect(parameters.page).to.have.property('in', 'query')
            expect(parameters.page).to.have.property('type', 'object')
            expect(parameters).to.have.property('filter')
            expect(parameters.filter).to.have.property('in', 'query')
            expect(parameters.filter).to.have.property('type', 'object')
        })
        it('should describe POST /people parameters', function () {
            const api = apis['/people'].post
            //expect(api.consumes).to.eql(['application/json'])
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe GET /people/changes/streaming parameters', function () {
            const api = apis['/people/changes/streaming'].get
            expect(api.parameters).to.not.exist
        })
        it('should describe GET /people/{id} parameters', function () {
            const api = apis['/people/{id}'].get
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe PATCH /people/{id} parameters', function () {
            const api = apis['/people/{id}'].patch
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe DELETE /people/{id} parameters', function () {
            const api = apis['/people/{id}'].delete
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe GET /people/{id}/relationships/pets parameters', function () {
            const api = apis['/people/{id}/relationships/pets'].get
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe POST /people/{id}/relationships/pets parameters', function () {
            const api = apis['/people/{id}/relationships/pets'].post
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe PATCH /people/{id}/relationships/pets parameters', function () {
            const api = apis['/people/{id}/relationships/pets'].patch
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe DELETE /people/{id}/relationships/pets parameters', function () {
            const api = apis['/people/{id}/relationships/pets'].delete
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe GET /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['/people/{id}/relationships/soulmate'].get
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe POST /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['/people/{id}/relationships/soulmate'].post
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe PATCH /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['/people/{id}/relationships/soulmate'].patch
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('in', 'body')
        })
        it('should describe DELETE /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['/people/{id}/relationships/soulmate'].delete
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('in', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
    })

})
