'use strict'

const _ = require('lodash')
const Hoek = require('hoek')

module.exports = function() {

    const _checkValidAdapter = function(adapter, protocolFunctions) {

        Hoek.assert(adapter, new Error('adapter missing'))
        
        protocolFunctions.forEach((func) => {
            Hoek.assert(adapter[func], new Error('Adapter validation failed. Adapter missing ' + func));
        })
    }

    const checkValidAdapter = function(adapter) {
        _checkValidAdapter(adapter, ['connect', 'disconnect', 'find', 'findById', 'create', 'delete', 'models', 'processSchema'])
    }

    const checkValidAdapterSSE = function(adapter) {
        _checkValidAdapter(adapter, ['connect', 'disconnect', 'streamChanges'])
    }

    const getAdapter = function(adapter) {
        if ( _.isString(adapter)) {
            try {
                return require('../../lib/adapters/' + adapter);
            } catch (err) {
                Hoek.assert(!err, new Error('Unexpected error when loading adapter ' + adapter))
            }
        }

        return adapter;
    }

    return { checkValidAdapter, checkValidAdapterSSE, getAdapter }
}