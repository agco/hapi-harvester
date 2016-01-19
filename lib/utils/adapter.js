'use strict'

const _ = require('lodash')
const Hoek = require('hoek')
const protocolFunctions = ['connect', 'disconnect', 'find', 'findById', 'create', 'delete', 'models', 'processSchema'];

module.exports = function() {

    const checkValidAdapter = function(adapter) {

        Hoek.assert(adapter, new Error('No adapter passed. Please see docs.'))
        
        protocolFunctions.forEach((func) => {
            Hoek.assert(adapter[func], new Error('Adapter validation failed. Adapter missing ' + func));
        })
    }
    
    return { checkValidAdapter }
}