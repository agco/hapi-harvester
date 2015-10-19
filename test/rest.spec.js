'use strict'

const _ = require('lodash')
const Joi = require('joi')
const Promise = require('bluebird')
const Hapi = require('hapi')

let server, buildServer, destroyServer, hh;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        description: Joi.string()
    }
};

describe('Rest operations', function() {
    
    beforeEach(function(done) {
        buildServer(done)
    })
    
    afterEach(function(done) {
        destroyServer(done)
    })
    
    it('Will be able to get from /brands', function() {
        const data = {
            attributes: {
                code: 'MF',
                description: 'Massey Furgeson'
            }
        };
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            var result = _.omit(res.result, 'id');
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })
    
    it('Will be able to post to /brands', function() {
        const data = {
            attributes: {
                code: 'MF',
                description: 'Massey Furgeson'
            }
        };
        
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            var result = _.omit(res.result, 'id');
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
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
            ['get', 'put', 'post', 'patch', 'delete'].forEach(function(verb) {
                server.route(hh.routes[verb](schema))
            })
            done()  
        })  
    })
}

destroyServer = function(done) {
    server.stop(done)
}