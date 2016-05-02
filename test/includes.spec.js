'use strict';

const _ = require('lodash');
const seeder = require('./seeder');
const Joi = require('joi');
const utils = require('./utils');

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
            },
            lovers: {
                data: [{type: 'people'}]
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
};

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
                },
                lovers: {
                    data: [{type: 'people', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}]
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
                },
                lovers: {
                    data: [{type: 'people', id: 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc'}]
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
};


describe('Inclusion', function () {

    before(function () {
        return utils.buildDefaultServer(schema).then((server) => {
            return seeder(server).dropCollectionsAndSeed(data);
        })
    });

    after(utils.createDefaultServerDestructor());

    describe('many to many', function () {
        it('should include referenced pets when querying people', function () {
            return server.injectThen({method: 'get', url: '/people?include=pets'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                const body = res.result;
                expect(body.data).to.have.length(2);
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(3);
                const expectedIncludedPets = ['c344d722-b7f9-49dd-9842-f0a375f7dfdc',
                                            'a344d722-b7f9-49dd-9842-f0a375f7dfdc',
                                            'b344d722-b7f9-49dd-9842-f0a375f7dfdc'];
                _.forEach(body.included, function (item) {
                    expect(item).to.have.property('type', 'pets');
                    expect(expectedIncludedPets).to.contain(item.id);
                });

            });
        });
        it('should include referenced lovers when querying people only in data section', function () {
            return server.injectThen({method: 'get', url: '/people?include=lovers'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                const body = res.result;
                expect(body.data).to.have.length(2);
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(0);

            });
        });
    });

    describe('one to one', function () {
        it('should include soulmate when querying people', function () {
            return server.injectThen({method: 'get', url: '/people?include=soulmate&filter[id]=abcdefff-b7f9-49dd-9842-f0a375f7dfdc'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                const body = res.result;
                expect(body.data).to.have.length(1);
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(1);
                expect(body.included[0]).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc');
                expect(body.included[0]).to.have.property('type', 'people');
            });
        });
        it('should include soulmate when getting resource by id', function () {
            return server.injectThen({method: 'get', url: '/people/abcdefff-b7f9-49dd-9842-f0a375f7dfdc?include=soulmate'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                const body = res.result;
                expect(body.data).to.be.an.Object;
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(1);
                expect(body.included[0]).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc');
                expect(body.included[0]).to.have.property('type', 'people');
            });
        });
    });

    describe('repeated entities', function () {
        it('should deduplicate included soulmate & lovers when querying people', function () {
            return server.injectThen({method: 'get', url: '/people?include=soulmate,lovers,pets&filter[id]=abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                .then(function (res) {
                    const body = res.result
                    expect(body.included).to.be.an.Array
                    expect(body.included).to.have.length(3)
                    var log = {}
                    _.each(body.included, function (person) {
                        expect(log).to.not.have.property(person.id)
                        log[`${person.type}:${person.id}`] = person
                    })
                })
        })
    })

    describe('compound documents', function () {
        it('should include pet and person when querying collars', function () {
            return server.injectThen({method: 'get', url: '/collars?include=collarOwner.owner.soulmate,collarOwner,collarOwner.owner'})
                .then(function (res) {
                    const body = res.result;
                    expect(body.included).to.be.an.Array;
                    expect(body.included).to.have.length(3);
                    _.forEach(body.included, function (item) {
                        if (item.type === 'pets' && item.id === 'b344d722-b7f9-49dd-9842-f0a375f7dfdc') {
                            return;
                        }
                        if (item.type === 'people' && item.id === 'abcdefff-b7f9-49dd-9842-f0a375f7dfdc') {
                            return;
                        }
                        if (item.type === 'people' && item.id === 'c344d722-b7f9-49dd-9842-f0a375f7dfdc') {
                            return;
                        }
                        throw new Error('Unexpected included item: ' + JSON.stringify(item, null, 2));
                    });
                });
        });
        it('should handle to-many relationship in include', function () {
            return server.injectThen({method: 'get', url: '/people?include=pets.owner&filter[id]=abcdefff-b7f9-49dd-9842-f0a375f7dfdc'})
                .then(function (res) {
                    const body = res.result;
                    expect(body.included).to.be.an.Array;
                    expect(body.included).to.have.length(2);
                    _.forEach(body.included, function (item) {
                        if (item.type === 'pets' && item.id === 'c344d722-b7f9-49dd-9842-f0a375f7dfdc') {
                            return;
                        }
                        if (item.type === 'pets' && item.id === 'a344d722-b7f9-49dd-9842-f0a375f7dfdc') {
                            return;
                        }
                        throw new Error('Unexpected included item: ' + JSON.stringify(item, null, 2));
                    });
                });
        });
        describe('when relationship not defined on schema', function () {
            it('should respond with 500', function () {
                return server.injectThen({method: 'get', url: '/ents?include=owner'})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(500);
                    });
            });
        });
    });

    describe('empty inclusion array', function () {
        it('should NOT throw error', function () {
            const includes = require('../lib/includes.js')(server, harvester.adapter, harvester.schemas);
            includes.appendLinkedResources(null, {data: []}, 'people', []);
        });
    });
});
