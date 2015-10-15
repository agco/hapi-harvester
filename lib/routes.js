'use strict'

module.exports = function () {

    let get = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}`
        }
    }
    
    let post = function (schema) {
        return {
            method: 'POST',
            path: `/${schema.type}`
        }
    }
	
	let put = function (schema) {
        return {
            method: 'PUT',
            path: `/${schema.type}`
        }
    }
	
	let patch = function (schema) {
        return {
            method: 'PATCH',
            path: `/${schema.type}`
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
        post: post,
		put: put,
        patch: patch,
		delete: del,
        options: options
    }

}