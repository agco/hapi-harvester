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
                pets: []
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
    ]
}


describe('Related links resolution', function () {

    before(function () {
        return utils.buildDefaultServer(schema).then((server) => {
            return seeder(server).dropCollectionsAndSeed(data)
        })
    })

    after(utils.createDefaultServerDestructor())

    describe('to-one relationship', function () {
        it('should resolve referenced item', function () {
            return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate'}).then(function (res) {
                expect(res.statusCode).to.equal(200)
                const body = res.result
                expect(body.data).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc')
            })
        })
        describe('and relation is not defined', function () {
            it('should resolve null', function () {
                return server.injectThen({method: 'get', url: '/people/c344d722-b7f9-49dd-9842-f0a375f7dfdc/relationships/soulmate'}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    const body = res.result
                    expect(body.data).to.have.equal(null)
                })
            })
        })
    })
    describe('to-many relationship', function () {
        it('should resolve referenced items', function () {
            return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/relationships/pets'}).then(function (res) {
                expect(res.statusCode).to.equal(200)
                const body = res.result
                expect(body.data).to.be.an.Array
                expect(body.data).to.have.length(2)
                const expectedPet = ['c344d722-b7f9-49dd-9842-f0a375f7dfdc', 'a344d722-b7f9-49dd-9842-f0a375f7dfdc']
                _.forEach(body.data, function (item) {
                    expect(expectedPet).to.include(item.id)
                })
            })
        })
        describe('and relation is not defined', function () {
            it('should resolve empty array', function () {
                return server.injectThen({method: 'get', url: '/people/c344d722-b7f9-49dd-9842-f0a375f7dfdc/relationships/pets'}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    const body = res.result
                    expect(body.data).to.be.an.Array
                    expect(body.data).to.have.length(0)
                })
            })
        })
    })

})
