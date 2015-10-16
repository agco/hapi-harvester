'use strict'

const _ = require('lodash')
const Hoek = require('hoek')
const protocolFunctions = ['connect','disconnect','find','findById','create','delete', 'models','processSchema'];

module.exports = function() {
    let checkValidAdapter = function(adapter) {

        Hoek.assert(adapter, new Error('No adapter passed. Please see docs.'))
        
        protocolFunctions.forEach((func) => {
            Hoek.assert(adapter[func], new Error('Adapter validation failed. Adapter missing ' + func));
        })
    }
    
    let getStandardAdapter = function(adapter) {
        if ( _.isString(adapter)) {
            try {
                return require('../../lib/adapters/' + adapter)();
            } catch (err) {
                Hoek.assert(!err, new Error('Wrong adapter name, see docs for built in adapter'))   
            }
        }
        
        return adapter;
    }
    
    return {
        checkValidAdapter,
        getStandardAdapter
    }
}