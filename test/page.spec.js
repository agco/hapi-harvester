'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const Hapi = require('hapi')

let server, buildServer, destroyServer, hh;

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

//TODO just done the validation, actual includes is remaining
describe('Paging', function() {
    
    beforeEach(function(done) {
        buildServer(() => {
            let promises = [];
        
           _.times(50, (index) => {
                let payload = Object.assign({}, data)
                payload.attributes.year = 2000 + index;
                promises.push(server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}))
            })
            
            return Promise.all(promises)
            .then(() => {
                done()
            })
        })
    })
    
    afterEach(function(done) {
        destroyServer(done)
    })
    
    it('Will be able to GET all from /brands with a paging param', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=year&page[limit]=10'})
        .then((res) => {
            expect(res.result.data).to.have.length(10)
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data.attributes.year).to.equal(2000 + index) 
            })
        })
    })
    
    it('Will be able to GET all from /brands with multiple paging params', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=year&page[offset]=20&page[limit]=10'})
        .then((res) => {
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data.attributes.year).to.equal(2020 + index)
            })
        })
    })
    
    it('Won\'t be able to GET all from /brands with multiple paging params where one is not available in attributes', function() {
        
        return server.injectThen({method: 'get', url: '/brands?page[foo]=bar&page[limit]=100'})
        .then((res) => {
            expect(res.statusCode).to.equal(400)  
        })
    })
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
    utils.removeFromDB(server, ['brands'])
    .then((res) => {
        server.stop(done)  
    })
}
