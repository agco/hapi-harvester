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

describe('Rest operations when things go right', function() {
    
    beforeEach(function(done) {
        buildServer(done)
    })
    
    afterEach(function(done) {
        destroyServer(done)
    })
    
    it('Will be able to GET by id from /brands', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'get', url: '/brands/' + res.result.data.id})
        })
        .then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })
    
    it('Will be able to GET all from /brands', function() {
        let promises = [];
        
        _.times(10, () => {
            promises.push(server.injectThen({method: 'post', url: '/brands', payload: {data}}))
        })
        
        return Promise.all(promises)
        .then((res) => {
            return server.injectThen({method: 'get', url: '/brands'})
        })
        .then((res) => {
            res.result.data.forEach((data) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data).to.deep.equal(data)  
            })
        })
    })
    
    it('Will be able to POST to /brands', function() {
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })
    
    it('Will be able to PATCH in /brands', function() {
        const payload = {
            attributes: {
                code: 'VT',
                description: 'Valtra'
            }
        };
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'patch', url: '/brands/' + res.result.data.id, payload: {data : payload}})
        })
        .then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(payload)
        })
    })
    
    it('Will be able to DELETE in /brands', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'delete', url: '/brands/' + res.result.data.id})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(204)
        })
    })
})

describe('Rest operations when things go wrong', function() {
    
    beforeEach(function(done) {
        buildServer(done)
    })
    
    afterEach(function(done) {
        destroyServer(done)
    })
    
    it('Won\'t be able to POST to /brands with a payload that doesn\'t match the schema', function() {
        
        let payload = _.cloneDeep(data);
        payload.foo = 'bar'
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })
    
    it('Won\'t be able to POST to /brands with a payload that has attributes that don\'t match the schema', function() {
        
        let payload = _.cloneDeep(data);
        payload.attributes.foo = 'bar'
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })
    
    it('Won\'t be able to GET by id from /brands if id is wrong', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'get', url: '/brands/foo'})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(404)
        })
    })
    
    it('Will be able to PATCH in /brands with wrong id', function() {
        const payload = {
            attributes: {
                code: 'VT',
                description: 'Valtra'
            }
        };
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'patch', url: '/brands/foo', payload: {data : payload}})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(404)
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
    return server.stop(done)  
    utils.removeFromDB(server, 'brands')
    .then((res) => {
        server.stop(done)  
    })
}