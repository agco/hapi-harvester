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
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson',
        year: 2000
    }
};


//TODO just done the validation, actual sorts is remaining
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
    
    it('Won\'t be able to GET all from /brands with an sort param not available in attributes', function() {
        return server.injectThen({method: 'get', url: '/brands?sort=code,foo'})
        .then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })
})

buildServer = function(done) {
    const Hapi = require('hapi')
    const plugin = require('../')
    const adapter = plugin.getAdapter('mongodb')
    server = new Hapi.Server()
    server.connection({port : 9100})
    server.register([
        {register: require('../'), options: {adapter: adapter({mongodbUrl: 'mongodb://localhost/test'})}},
        {register: require('inject-then')}
    ], () => {
        hh = server.plugins.harvester;
        server.start(() => {
            ['get', 'getById', 'post', 'patch', 'delete'].forEach(function(verb) {
                server.route(hh.routes[verb](schema))
            })
            done()  
        })  
    })
}

destroyServer = function(done) {
    utils.removeFromDB(server, 'brands')
    .then((res) => {
        server.stop(done)  
    })
}