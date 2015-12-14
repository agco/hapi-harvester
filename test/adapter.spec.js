'use strict'

const _ = require('lodash')
const Hapi = require('hapi')
const utils = require('./utils');

let server, destroyServer, harvester;

describe('Adapter Validation', function() {
    
    afterEach(function(done) {
        destroyServer(done);
    })
    
    it('Will check the given adapter for the required functions', function() {
        let adapter = require('../').getAdapter('mongodb')
        
        adapter = _.remove(adapter, 'delete');
        
        //rebuild server with the aling adapter
        server = new Hapi.Server()
        server.connection({port : 9100})
        
        const serverSetup = function() {
            server.register([
                {register: require('../lib/plugin'), options: {adapter : adapter}},
                {register: require('inject-then')}
            ], () => {
                harvester = server.plugins.harvester;
                server.start(()=> {})   
            })  
        }
        
        expect(serverSetup).to.throw('Adapter validation failed. Adapter missing connect')
    })
    
    it('Will won\'t accept a string adapter if it doesn\'t exist ', function() {
        //rebuild server with the aling adapter
        server = new Hapi.Server()
        server.connection({port : 9100})
        
        const serverSetup = function() {
            const adapter = require('../').getAdapter('nonexistant')
            server.register([
                {register: require('../lib/plugin'), options: {adapter : adapter}},
                {register: require('inject-then')}
            ], () => {
                harvester = server.plugins.harvester;
                server.start(()=> {})   
            })  
        }
        
        expect(serverSetup).to.throw('Wrong adapter name, see docs for built in adapter')
    })
})

destroyServer = function(done) {
    server.stop(done)
}
