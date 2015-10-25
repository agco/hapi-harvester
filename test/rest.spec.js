'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const Hapi = require('hapi')
const uuid = require('node-uuid')

let server, buildServer, destroyServer, hh;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        description: Joi.string()
    }
};

const data = {
    type: 'brands',
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
        let payload = _.cloneDeep(data)
        payload.id = uuid.v4()
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })
    
    it('Will be able to POST to /brands with uuid', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })
    
    it('Will be able to PATCH in /brands', function() {
        const payload = {
            type: 'brands',
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
    
    it('Won\'t be able to POST to /brands with a payload that doesn\'t have a type property', function() {
        
        let payload = _.cloneDeep(data);
        delete payload.type
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })
    
    
    it('Won\'t be able to POST to /brands with an invalid uuid', function() {
        
        let payload = _.cloneDeep(data);
        // has to match this /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}
        payload.id = '54ce70cd-9d0e-98e8-89c2-1423affcb0ca'
        
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