'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const Hapi = require('hapi')

let server, buildServer, destroyServer, hh;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        description: Joi.string(),
        year: Joi.number()
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
    
    beforeEach(function(done) {
        buildServer(() => {
            let promises = [];
        
            _.times(10, (index) => {
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

buildServer = function(done) {
    return utils.buildServer(schema)
        .then((res) => {
            server = res.server;
            hh = res.hh;
            done()
        })
}

destroyServer = function(done) {
    utils.removeFromDB(server, 'brands')
    .then((res) => {
        server.stop(done)  
    })
}