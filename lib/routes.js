'use strict'

const schemaUtils = require('./utils/schema')()

module.exports = function () {

    let get = function (schema) {
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
            path: `/${schema.type}/{id}`,
            config: {
                validate: {
                    query: false
                }
            }
        }
    }
    
    let post = function (schema) {
        return {
            method: 'POST',
            path: `/${schema.type}`,
            config: {
                payload: {
                    allow: 'application/json'
                },
                validate: {
                    payload: schemaUtils.toJoiPostValidatation(schema)
                }
            }
        }
    }
    
    let put = function (schema) {
        return {
            method: 'PUT',
            path: `/${schema.type}`,
            config: {
                payload: {
                    allow : 'application/json'
                }
            }
        }
    }
    
    let patch = function (schema) {
        return {
            method: 'PATCH',
            path: `/${schema.type}`,
            config: {
                payload: {
                    allow : 'application/json'
                }
            }
        }
    }
    
    let del = function (schema) {
        return {
            method: 'DELETE',
            path: `/${schema.type}`
        }
    }
    
    let options = function (schema) {
        return {
            method: 'OPTIONS',
            path: `/${schema.type}`
        }
    }
    
    return {
        get: get,
        getById: getById,
        post: post,
        put: put,
        patch: patch,
        delete: del,
        options: options
    }

}