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
            pets: [{type: 'pets'}],
            soulmate: {type: 'people'}
        }
    },
    pets: {
        type: 'pets',
        attributes: {
            name: Joi.string()
        },
        relationships: {
            owner: {type: 'people'}
        }
    },
    collars: {
        type: 'collars',
        attributes: {},
        relationships: {
            collarOwner: {type: 'pets'}
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
                pets: [{type: 'pets', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}, {type: 'pets', id: 'a344d722-b7f9-49dd-9842-f0a375f7dfdc'}],
                soulmate: {type: 'people', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}
            }
        },
        {
            type: 'people',
            id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc',
            attributes: {
                name: 'Paul'
            },
            relationships: {
                pets: [{type: 'pets', id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'}]
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
                owner: {type: 'people', id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc'}
            }
        }
    ],
    collars: [
        {
            type: 'collars',
            relationships: {
                collarOwner: {type: 'collars', id: 'b344d722-b7f9-49dd-9842-f0a375f7dfdc'}
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
                        expect(body.data.relationships.soulmate.id).to.equal('b344d722-b7f9-49dd-9842-f0a375f7dfdc')
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
                        expect(body.data.relationships.soulmate).to.be.null
                    })
            })
        })
        describe('DELETE', function () {
            it('should delete relationship ', function () {
                return server.injectThen({method: 'delete', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate'})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(204)
                        return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                    }).then(function (res) {
                        const body = res.result
                        expect(body.data.relationships.soulmate).to.be.null
                    })
            })
        })
        describe('POST', function () {
            it('should delete relationship ', function () {
                return server.injectThen({method: 'post', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate'})
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
                        expect(_.pluck(body.data.relationships.pets, 'id')).to.eql(['b344d722-b7f9-49dd-9842-f0a375f7dfdc'])
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
                        expect(_.pluck(body.data.relationships.pets, 'id').sort()).to.eql(expectedItems)
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
                        expect(body.data.relationships.pets).to.be.null
                    })
            })
        })
    })

})
