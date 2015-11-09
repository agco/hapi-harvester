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
    before(function () {
           return utils.buildDefaultServer(schema).then(function (server) {
               return seeder(server).dropCollectionsAndSeed(data);
           });
       });

       after(utils.createDefaultServerDestructor());
    
    it('Will be able to GET all from /brands with a sparse fieldset', function() {
        
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
    
    it('Will be able to GET all from /brands with multiple fieldset', function() {
        
        return server.injectThen({method: 'get', url: '/brands?fields[brands]=code,description'})
        .then((res) => {
            res.result.data.forEach((data) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data).to.deep.equal(data)
            })
        })
    })
    
    it('Won\'t be able to GET all from /brands with multiple fieldset where one is not available in attributes', function() {
        
        return server.injectThen({method: 'get', url: '/brands?fields[foo]=bar&fields[description]=Massey Furgeson'})
        .then((res) => {
            expect(res.statusCode).to.equal(400)  
        })
    })
})
