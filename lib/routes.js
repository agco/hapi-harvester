module.exports = function () {

    const get = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}`
        }
    }
    const post = function (schema) {
        return {
            method: 'POST',
            path: `/${schema.type}`
        }
    }
	
	 const put = function (schema) {
        return {
            method: 'PUT',
            path: `/${schema.type}`
        }
    }
	
	 const patch = function (schema) {
        return {
            method: 'PATCH',
            path: `/${schema.type}`
        }
    }
	
	 const del = function (schema) {
        return {
            method: 'DELETE',
            path: `/${schema.type}`
        }
    }
	
    return {
        get: get,
        post: post,
		put: put,
        patch: patch,
		delete: del
    }

}