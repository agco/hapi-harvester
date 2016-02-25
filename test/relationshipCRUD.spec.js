'use strict'

const _ = require('lodash')
const seeder = require('./seeder')
const Joi = require('joi')
const utils = require('./utils')

const schema = {
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
    },
    collars: {
        type: 'collars',
        attributes: {},
        relationships: {
            collarOwner: {
                data: {type: 'pets'}
            }
        }
    },
    ents: {
        type: 'ents',
        attributes: {}
    }
}

const data = {
    people: [
        {
            type: 'people',
            id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Jack',
                appearances: 2007
            },
            relationships: {
                pets: {
                    data: [{type: 'pets', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}, {type: 'pets', id: 'a344d722-b7f9-49dd-9842-f0a375f7dfdc'}]
                },
                soulmate: {
                    data: {type: 'people', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}
                }
            }
        },
        {
            type: 'people',
            id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Paul'
            },
            relationships: {
                pets: {
                    data: [{type: 'pets', id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'}]
                }
            }
        }
    ],
    pets: [
        {
            type: 'pets',
            id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Dogbert'
            }
        },
        {
            type: 'pets',
            id: 'a344d722-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Catbert'
            }
        },
        {
            type: 'pets',
            id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Horsepol'
            },
            relationships: {
                owner: {
                    data: {type: 'people', id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc'}
                }
            }
        }
    ],
    collars: [
        {
            type: 'collars',
            relationships: {
                collarOwner: {
                    data: {type: 'pets', id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'}
                }
            }
        }
    ]
}


describe('Relationship CRUD', function () {

    before(function () {
        return utils.buildDefaultServer(schema)
    })

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(data)
    })

    after(utils.createDefaultServerDestructor())

    describe('to one', function () {
        describe('PATCH', function () {
            it('should update relationship ', function () {
                const payload = {
                    data: {
                        type: 'people',
                        id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'
                    }
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(body.data.relationships.soulmate.data.id).to.equal('b344d722-b7f9-49dd-9842-f0a375f7dfdc')
                    })
            })
            it('should delete relationship ', function () {
                const payload = {
                    data: null
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(body.data.relationships.soulmate.data).to.be.null
                    })
            })
            it('should respond with 400 status code when data missing', function () {
                const payload = {}
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(400)
                        const body = JSON.parse(res.payload)
                        expect(body.errors).to.have.length(1)
                        expect(body.errors[0]).to.have.deep.property('validation.keys')
                        expect(body.errors[0].validation.keys).to.include('data')
                    })
            })
            it('should respond with 400 status code when id is not UUID v4', function () {
                const payload = {
                    data: {
                        type: 'soulmate',
                        id: '123'
                    }
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(400)
                        const body = JSON.parse(res.payload)
                        expect(body.errors).to.have.length(1)
                        expect(body.errors[0]).to.have.deep.property('validation.keys')
                        expect(body.errors[0].validation.keys).to.include('data.id')
                    })
            });
            it('should respond with 400 status code when id is missing', function () {
                const payload = {
                    data: {
                        type: 'people'
                    }
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(400)
                        const body = JSON.parse(res.payload)
                        expect(body.errors).to.have.length(1)
                        expect(body.errors[0]).to.have.deep.property('validation.keys')
                        expect(body.errors[0].validation.keys).to.include('data.id')
                    })
            });
            it('should respond with 400 status code when type is invalid', function () {
                const payload = {
                    data: {
                        type: 'zonk',
                        id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc'
                    }
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(400)
                        const body = JSON.parse(res.payload)
                        expect(body.errors).to.have.length(1)
                        expect(body.errors[0]).to.have.deep.property('validation.keys')
                        expect(body.errors[0].validation.keys).to.include('data.type')
                    })
            });
            it('should respond with 400 status code when type is missing', function () {
                const payload = {
                    data: {
                        id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc'
                    }
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(400)
                        const body = JSON.parse(res.payload)
                        expect(body.errors).to.have.length(1)
                        expect(body.errors[0]).to.have.deep.property('validation.keys')
                        expect(body.errors[0].validation.keys).to.include('data.type')
                    })
            });
        })
        describe('DELETE', function () {
            it('should delete relationship ', function () {
                return server.injectThen({method: 'delete', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate'})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(body.data.relationships.soulmate.data).to.be.null
                    })
            })
        })
        describe('POST', function () {
            it('should respond with 403', function () {
                const payload = {
                    data: {
                        type: 'people',
                        id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'
                    }
                }
                return server.injectThen({method: 'post', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(403)
                    })
            })
        })
    })


    describe('to many', function () {
        describe('PATCH', function () {
            it('should update relationship ', function () {
                const payload = {
                    data: [
                        {
                            type: 'pets',
                            id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'
                        }
                    ]
                }
                return server.injectThen({method: 'patch', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/pets', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(_.pluck(body.data.relationships.pets.data, 'id')).to.eql(['b344d722-b7f9-49dd-9842-f0a375f7dfdc'])
                    })
            })
        })
        describe('POST', function () {
            it('should add item to relationship collection (duplicate free)', function () {
                const payload = {
                    data: [
                        {
                            type: 'pets',
                            id: 'a344d722-b7f9-49dd-9842-f0a375f7dfdc'
                        },
                        {
                            type: 'pets',
                            id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'
                        }
                    ]
                }
                return server.injectThen({method: 'post', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/pets', payload: payload})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        const expectedItems = ['a344d722-b7f9-49dd-9842-f0a375f7dfdc',
                                               'b344d722-b7f9-49dd-9842-f0a375f7dfdc',
                                               'c344d722-b7f9-49dd-9842-f0a375f7dfdc']
                        expect(_.pluck(body.data.relationships.pets.data, 'id').sort()).to.eql(expectedItems)
                    })
            })
        })
        describe('DELETE', function () {
            it('should delete relationship ', function () {
                return server.injectThen({method: 'delete', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/pets'})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(body.data.relationships.pets.data).to.be.null
                    })
            })
        })
    })

})
