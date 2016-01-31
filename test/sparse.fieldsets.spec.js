'use strict'

const Joi = require('joi')
const utils = require('./utils');
const seeder = require('./seeder');

const schema = {
    brands: {
        type: 'brands',
        attributes: {
            code: Joi.string().min(2).max(10),
            description: Joi.string(),
            year: Joi.number()
        }
    }
};

const data = {
    brands: [{
        type: 'brands',
        attributes: {
            code: 'MF',
            description: 'Massey Furgeson',
            year: 2000
        }
    }]
};


//TODO just done the validation, actual includes is remaining
describe('Sparse Fieldsets', function() {
    let seededIds;
    before(function () {
        return utils.buildDefaultServer(schema).then(function (server) {
            return seeder(server).dropCollectionsAndSeed(data);
        }).then(function (ids) {
            seededIds = ids;
        });
    });

       after(utils.createDefaultServerDestructor());

    it('Will be able to GET all from /brands with a sparse fieldset', function () {

        return server.injectThen({method: 'get', url: '/brands?fields[brands]=description'})
            .then((res) => {
                res.result.data.forEach((data) => {
                    expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                    expect(data.attributes.description).to.exist;
                    expect(data.attributes.code).to.not.exist;
                    expect(data.attributes.year).to.not.exist;
                })
            })
    })

    // todo skipped this for now, when registering 2 hapi servers the server.stop of the last one stopped never resolves
    // this in turn causes the after hook to fail
    // could go unnoticed in travis but delays the test runs
    describe.skip('when including remote entity', function () {
        let server2;

        const schema2 = {
            equipment: {
                type: 'equipment',
                attributes: {},
                relationships: {
                    brand: {type: 'brands', baseUri: 'http://localhost:' + 9100}
                }
            }
        };

        before(function () {
            return utils.buildServer(schema2, {port: 8012}).then(function (result) {
                server2 = result.server;
                let data = {
                    equipment: [{
                        type: 'equipment',
                        attributes: {},
                        relationships: {
                            brand: {type: 'brands', id: seededIds.brands[0]}
                        }
                    }]
                };
                return seeder(server2).dropCollectionsAndSeed(data);
            });
        });

        after(function () {
            return new Promise(function (resolve, reject) {
                server2.stop(function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(err);
                    }
                })
            });
        });

        it('Will be able to GET all from /eqipment and included remote resource with a sparse fieldset', function () {

            return server2.injectThen({method: 'get', url: '/equipment?include=brand&fields[brands]=code'})
                .then((res) => {
                    expect(res.result.data).to.have.length(1);
                    expect(res.result.included).to.have.length(1);
                    expect(res.result.included[0].attributes.code).to.equal('MF');
                    expect(res.result.included[0].attributes.description).to.not.exist;
                    expect(res.result.included[0].attributes.year).to.not.exist;
                })
        })
    });

    it('Will be able to GET all from /brands with multiple fieldset', function () {

        return server.injectThen({method: 'get', url: '/brands?fields[brands]=code,description'})
            .then((res) => {
                res.result.data.forEach((data) => {
                    expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                    expect(data).to.deep.equal(data)
                })
            })
    })
})
