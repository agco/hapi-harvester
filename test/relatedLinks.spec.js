'use strict'

const _ = require('lodash')
const seeder = require('./seeder')
const Joi = require('joi')
const url = require('url')
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
                    data: []
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
    ]
}

describe('Related links', () => {

    before(function () {
        return utils.buildDefaultServer(schema).then((server) => {
            server.route({
                method: 'get',
                path: '/people/{id}/hello',
                handler: function (request, reply) {
                    reply('world');
                }
            });
            return seeder(server).dropCollectionsAndSeed(data)
        })
    });

    after(utils.createDefaultServerDestructor());

    describe('Resolution', function () {

        describe('to-one relationship', function () {
            it('should resolve referenced item', function () {
                return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/soulmate'}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    const body = res.result
                    expect(body.data).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc')
                })
            })
            describe('and relation is not defined', function () {
                it('should resolve null', function () {
                    return server.injectThen({method: 'get', url: '/people/c344d722-b7f9-49dd-9842-f0a375f7dfdc/soulmate'}).then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const body = res.result
                        expect(body.data).to.have.equal(null)
                    })
                })
            })
        })
        describe('to-many relationship', function () {
            it('should resolve referenced items', function () {
                return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/pets'}).then(function (res) {
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
                    return server.injectThen({method: 'get', url: '/people/c344d722-b7f9-49dd-9842-f0a375f7dfdc/pets'}).then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const body = res.result
                        expect(body.data).to.be.an.Array
                        expect(body.data).to.have.length(0)
                    })
                })
            })

        })

        describe('non relationship url', function () {
            it('should not be rewritten', function () {
                return server.injectThen({method: 'get', url: '/people/c344d722-b7f9-49dd-9842-f0a375f7dfdc/hello'}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    const body = res.result
                    expect(body).to.equal('world')
                })
            })
        })

    });

    describe('Generation', function() {
        describe('base document', () => {
            it('contains a related link for each relationship document', () => {
                return server.injectThen({method: 'get', url: '/people/' + data.people[0].id})
                    .then((res) => {
                        expect(res.statusCode).to.equal(200);
                        const person = res.result.data;
                        expect(person).to.exist;
                        const relatedLink = person.relationships.pets.links.related;
                        const path = url.parse(relatedLink).path;
                        expect(relatedLink).to.be.a.String;
                        expect(path).to.equal("/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc/pets");
                    });
            });
        });
    });
});
