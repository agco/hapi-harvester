'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
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
    type: 'brands',
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson',
        year: 2000
    }
};

describe('Sorting', function() {

    before(function () {
        return utils.buildDefaultServer(schema).then(function (server) {
            var brands = [];
            _.times(10, (index) => {
                let payload = _.cloneDeep(data);
                payload.attributes.year = 2000 + index;
                brands.push(payload);
            });
            return seeder(server).dropCollectionsAndSeed({brands: brands});
        });
    });

    after(utils.createDefaultServerDestructor());

    
    it('Will be able to GET all from /brands with a sort param', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=year'})
        .then((res) => {
            var sortedResults = _.sortBy(res.result.data, 'attributes.year')
            expect(sortedResults).to.deep.equal(res.result.data)
        })
    })
    
    it('Will be able to GET all from /brands with a sort param and descending', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=-year'})
        .then((res) => {
            
            var sortedResults = _.sortBy(res.result.data, 'attributes.year').reverse()
            expect(sortedResults).to.deep.equal(res.result.data)
        })
    })
    
    it('Won\'t be able to GET all from /brands with an sort param not available in attributes', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=code,foo'})
        .then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })
})
