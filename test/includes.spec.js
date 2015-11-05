'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const Hapi = require('hapi')
Promise.longStackTraces()
let server, buildServer, destroyServer, hh;

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
        }
    }
};

const data = [
    {
        type: 'people',
        attributes: {
            name: 'Jack',
            appearances: 2007
        },
        relationships: {
            pets: [{type: 'people', id: 'abc'}],
            soulmate: {type: 'people', id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc'}
        }
    },
    {
        type: 'people',
        id: 'c344d722-b7f9-49dd-9842-f0a375f7dfdc',
        attributes: {
            name: 'Paul'
        }
    }
];


describe.only('Inclusion', function () {

    beforeEach(function(done) {
        buildServer(() => {
            let promises = [];

            _.forEach(data, function (item) {
                promises.push(server.injectThen({method: 'post', url: '/' + item.type, payload: {data: item}}).then(function (res) {
                    if (res.statusCode != 201) {
                        throw new Error(JSON.stringify(res.result, null, 2));
                    } else {
                        return res;
                    }
                }));
            });


            return Promise.all(promises)
                .then(() => {
                    done()
                }, done);
        })
    })

    afterEach(function(done) {
        destroyServer(done)
    })

    describe('many to many', function () {
        it.only('should include referenced lovers when querying people', function () {
            return server.injectThen({method: 'get', url: '/people?include=pets'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                var body = res.result;
                expect(body.data).to.have.length(2);
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(1);
                expect(body.included[0]).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc');
            });
        });
    });

    describe('one to one', function () {
        it.skip('should include soulmate when querying people', function () {
            return server.injectThen({method: 'get', url: '/people?include=soulmate'}).then(function (res) {
                expect(res.statusCode).to.equal(200);
                var body = res.result;
                expect(body.data).to.have.length(2);
                expect(body).to.have.property('included');
                expect(body.included).to.be.an.Array;
                expect(body.included).to.have.length(1);
                expect(body.included[0]).to.have.property('id', 'c344d722-b7f9-49dd-9842-f0a375f7dfdc');
            });
        });
    });
    //Todo: add test for "," support.

    describe("repeated entities", function () {
        it.skip('should deduplicate included soulmate & lovers when querying people', function (done) {
            request(config.baseUrl).get('/people?include=soulmate,lovers').expect(200).end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.linked).should.be.an.Object;
                (body.linked.people).should.be.an.Array;
                var log = {};
                _.each(body.linked.people, function (person) {
                    should.not.exist(log[person.id]);
                    log[person.id] = person;
                });
                done();
            });
        });
    });

    describe('compound documents', function () {
        it.skip('should include pet and person when querying collars', function (done) {
            request(config.baseUrl)
                .get('/collars?include=collarOwner.owner.soulmate,collarOwner.food,collarOwner,collarOwner.owner')
                .expect(200)
                .end(function (err, res) {
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    should.exist(body.linked);
                    (body.linked).should.be.an.Object;
                    (body.linked.pets).should.be.an.Array;
                    (body.linked.pets.length).should.be.equal(1);
                    (body.linked.people).should.be.an.Array;
                    (body.linked.people.length).should.be.equal(2);
                    (body.linked.foobars).should.be.an.Array;
                    (body.linked.foobars.length).should.be.equal(1);
                    done();
                });
        });
    });

    describe('empty inclusion array', function () {
        it.skip('should NOT throw error', function () {
            var includes = require('../lib/includes.js')(this.harvesterApp, this.harvesterApp._schema);
            includes.linked({people: []}, []);
        });
    });

    //it('Will be able to GET all from /brands with a inclusion', function() {
    //    return server.injectThen({method: 'get', url: '/brands?include=code'})
    //    .then((res) => {
    //        res.result.data.forEach((result) => {
    //            let dataToCompare = _.pick(data.attributes, 'code')
    //            expect(result.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
    //            expect(result.attributes).to.deep.equal(dataToCompare)
    //        })
    //    })
    //})
    //
    //it('Will be able to GET all from /brands with multiple inclusions', function() {
    //    return server.injectThen({method: 'get', url: '/brands?include=code,description'})
    //    .then((res) => {
    //        res.result.data.forEach((result) => {
    //            let dataToCompare = _.pick(data.attributes, ['code', 'description'])
    //            expect(result.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
    //            expect(result.attributes).to.deep.equal(dataToCompare)
    //        })
    //    })
    //})
    //
    //it('Won\'t be able to GET all from /brands with an inclusion not available in attributes', function() {
    //    return server.injectThen({method: 'get', url: '/brands?include=code,foo'})
    //    .then((res) => {
    //        expect(res.statusCode).to.equal(400)
    //    })
    //})
})

buildServer = function(done) {
    return utils.buildServer(schema)
        .then((res) => {
            server = res.server;
            hh = res.hh;
            done()
        })
}

destroyServer = function(done) {
    utils.removeFromDB(server, ['people'])
    .then((res) => {
        server.stop(done)
    })
}
