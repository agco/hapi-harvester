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
        description: Joi.string()
    }
};

const data = {
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson'
    }
};


//TODO just done the validation, actual includes is remaining
describe('Sparse Fieldsets', function() {
    
    beforeEach(function(done) {
        buildServer(() => {
            let promises = [];
        
            _.times(10, () => {
                promises.push(server.injectThen({method: 'post', url: '/brands', payload: {data}}))
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
    
    it('Will be able to GET all from /brands with a sparse fieldset', function() {
        
        return server.injectThen({method: 'get', url: '/brands?include=code&fields[description]=Massey Furgeson'})
        .then((res) => {
            res.result.data.forEach((data) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data).to.deep.equal(data)  
            })
        })
    })
    
    it('Will be able to GET all from /brands with multiple fieldset', function() {
        
        return server.injectThen({method: 'get', url: '/brands?fields[code]=MS&fields[description]=Massey Furgeson'})
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

buildServer = function(done) {
    const Hapi = require('hapi')
    const plugin = require('../')
    let adapter = plugin.getAdapter('mongodb')
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