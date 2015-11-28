'use strict'

const schemaUtils = require('./utils/schema')()

module.exports = function () {

    const get = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}`,
            config: {
                validate: {
                    query: schemaUtils.toJoiGetQueryValidation(schema)
                }
            }
        }
    }
    
    const getById = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}/{id}/{relationship*}`,
            config: {
                validate: {
                    query: schemaUtils.toJoiGetQueryValidation(schema)
                }
            }
        }
    }

    const getChangesStreaming = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}/changes/streaming`
        }
    }
    
    const post = function (schema) {
        return {
            method: 'POST',
            path: `/${schema.type}`,
            config: {
                payload: {
                    allow: ['application/json', 'application/vnd.api+json']
                },
                validate: {
                    payload: schemaUtils.toJoiPostValidatation(schema)
                }
            }
        }
    }
    
    const patch = function (schema) {
        return {
            method: 'PATCH',
            path: `/${schema.type}/{id}`,
            config: {
                payload: {
                    allow : 'application/json'
                }
            }
        }
    }
    
    const del = function (schema) {
        return {
            method: 'DELETE',
            path: `/${schema.type}/{id}`
        }
    }
    
    const options = function (schema) {
        return {
            method: 'OPTIONS',
            path: `/${schema.type}`
        }
    }
    
    return {
        get: get,
        getById,
        getChangesStreaming,
        post,
        patch,
        delete: del,
        options
    }

}
