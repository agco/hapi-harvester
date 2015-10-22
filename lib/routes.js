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
            path: `/${schema.type}/{id}`,
            config: {
                validate: {
                    query: false
                }
            }
        }
    }
    
    const post = function (schema) {
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
            path: `/${schema.type}/{id}`,
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
        getById: getById,
        post: post,
        patch: patch,
        delete: del,
        options: options
    }

}