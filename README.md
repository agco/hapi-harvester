# hapi-harvester

## usage

```js
const hhPlugin = require('hapi-harvester')

server.register({
    register: hhPlugin, 
    options: {
       // bootstrap with a pre-built adapter, e.g Mongodb, Redis or roll your own
        adapter: require('hapi-harvester/adapters/mongodb')({mongodbUrl: 'mongodb://localhost/test'})
        // ...
    }
}, function (err) {

    // retrieve the plugin namespace from the server object
    const hh = server.plugins['hh']
    
    // define a jsonapi schema with Joi validation 
    var brands = {
        type: 'brands',
        attributes: {
            code: Joi.string(),
            description: Joi.string()
        }
    }

    // use the routes.get functions to generate a hapi GET route  
    const brandsGet = hh.routes.get(brands)
    
    // register the result as a route with the server
    server.route(brandsGet)
    
    // register additional routes using routes.getById .post .patch .delete
    server.route(hh.routes.getById(brands))
    server.route(hh.routes.post(brands))
    server.route(hh.routes.patch(brands))
    server.route(hh.routes.delete(brands))
    
    // or even reduce further with the shorthands
    // get, getById, post, patch, delete
    hh.routes.register(brands)
    // get, getById
    hh.routes.registerReadonly(brands)
    // get, getById, post 
    hh.routes.registerImmutable(brands)
    
})
```
