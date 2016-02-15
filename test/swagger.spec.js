'use strict'

const _ = require('lodash')
const Joi = require('joi')
const config = require('./config')

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
                {register: require('hapi-swagger'), options: {apiVersion: require('../package.json').version}}
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
        it('should contain version number equal to package.json version', function () {
            return server.injectThen({method: 'get', url: '/docs'}).then(function (res) {
                expect(res.result.apiVersion).to.equal(require('../package.json').version)
            })
        })
        it('should return list of registered resources', function () {
            return server.injectThen({method: 'get', url: '/docs'}).then(function (res) {
                expect(_.pluck(res.result.apis, 'path').sort()).to.eql(['people', 'pets'])
            })
        })
    })

    describe('GET /docs?path=people', function () {
        let result, apis
        before(function () {
            return server.injectThen({method: 'get', url: '/docs?path=people'}).then(function (res) {
                result = res.result
                apis = {}
                _.forEach(result.apis, function (item) {
                    let key = item.operations[0].method + ' ' + item.path
                    apis[key] = item
                })
            })
        })
        it('should return list of registered resources', function () {
            expect(result.apis).to.have.length(14)
        })
        it('should describe models', function () {
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
            const api = apis['GET /people'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('include')
            expect(parameters.include).to.have.property('paramType', 'query')
            expect(parameters.include).to.have.property('type', 'string')
            expect(parameters).to.have.property('fields')
            expect(parameters.fields).to.have.property('paramType', 'query')
            expect(parameters.fields).to.have.property('type', 'fields')
            expect(parameters).to.have.property('sort')
            expect(parameters.sort).to.have.property('paramType', 'query')
            expect(parameters.sort).to.have.property('type', 'string')
            expect(parameters).to.have.property('page')
            expect(parameters.page).to.have.property('paramType', 'query')
            expect(parameters.page).to.have.property('type', 'page')
            expect(parameters).to.have.property('filter')
            expect(parameters.filter).to.have.property('paramType', 'query')
            expect(parameters.filter).to.have.property('type', 'filter')
        })
        it('should describe POST /people parameters', function () {
            const api = apis['POST /people'].operations[0]
            expect(api.consumes).to.eql(['application/json'])
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
            expect(parameters.body).to.have.property('type', 'people')
        })
        it('should describe GET /people/changes/streaming parameters', function () {
            const api = apis['GET /people/changes/streaming'].operations[0]
            expect(api.parameters).to.have.length(0)
        })
        it('should describe GET /people/{id} parameters', function () {
            const api = apis['GET /people/{id}'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe PATCH /people/{id} parameters', function () {
            const api = apis['PATCH /people/{id}'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
            expect(parameters.body).to.have.property('type', 'peopleid')
        })
        it('should describe DELETE /people/{id} parameters', function () {
            const api = apis['DELETE /people/{id}'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe GET /people/{id}/relationships/pets parameters', function () {
            const api = apis['GET /people/{id}/relationships/pets'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe POST /people/{id}/relationships/pets parameters', function () {
            const api = apis['POST /people/{id}/relationships/pets'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
        })
        it('should describe PATCH /people/{id}/relationships/pets parameters', function () {
            const api = apis['PATCH /people/{id}/relationships/pets'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
        })
        it('should describe DELETE /people/{id}/relationships/pets parameters', function () {
            const api = apis['DELETE /people/{id}/relationships/pets'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe GET /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['GET /people/{id}/relationships/soulmate'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
        it('should describe POST /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['POST /people/{id}/relationships/soulmate'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
        })
        it('should describe PATCH /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['PATCH /people/{id}/relationships/soulmate'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
            expect(parameters).to.have.property('body')
            expect(parameters.body).to.have.property('paramType', 'body')
        })
        it('should describe DELETE /people/{id}/relationships/soulmate parameters', function () {
            const api = apis['DELETE /people/{id}/relationships/soulmate'].operations[0]
            const parameters = {}
            _.forEach(api.parameters, function (item) {
                parameters[item.name] = item
            })
            expect(parameters).to.have.property('id')
            expect(parameters.id).to.have.property('paramType', 'path')
            expect(parameters.id).to.have.property('type', 'string')
        })
    })

})
