# hapi-harvester

## usage

```js
const hhPlugin = require('hapi-harvester')

server.register({
    register: hhPlugin, 
    options: {
       // bootstrap with a adapter, pre-built ones available for Mongodb and Redis
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

    // use the routes.get functions to generate a hapi route  
    const brandsGet = hh.routes.get(brands)
    // register the result with the server
    server.route(brandsGet)
    
})
```

```js
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
```

```js

// brandsGet is a plain hapi route definition

{ method: 'GET',
  path: '/series',
  config: { validate: { query: {
    id: Joi.string().guid().description('id'),
    filter.
  }, options: {allowUnknown: true} } },
  handler: [Function] }

```
