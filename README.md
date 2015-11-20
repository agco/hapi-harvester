# hapi-harvester


```js
const hhPlugin = require('hapi-harvester')

// initialise a hapi server... register the hapi-harvester plugin
server.register({
    register: hhPlugin, 
    options: {
       // bootstrap with a prebuilt adapter
        adapter: require('hapi-harvester/adapters/mongodb')({mongodbUrl: 'mongodb://localhost/test', baseUri: server.info.uri})
        // ...
    }
}, function (err) {
    
    // define a jsonapi schema with Joi validation 
    var brands = {
        type: 'brands',
        attributes: {
            code: Joi.string(),
            description: Joi.string()
        }
    }
    
    // retrieve the plugin namespace from the server object
    const hh = server.plugins['hh']
    // call routes.get to generate a hapi route definition  
    const brandsGet = hh.routes.get(brands)
    // register the route
    server.route(brandsGet)
    
})
```

```js

// routes.get generates a plain hapi route definition
{ method: 'GET',
  path: '/series',
  config: { 
    validate: 
        { 
            query: {
                filter : {
                    id: Joi.string().guid().description('id'),
                    code: Joi.string(),
                    description: Joi.string()
                } 
            }, 
            options: {
                allowUnknown: true
            } 
        } 
    },
    handler: [Function] }
    
// add, remove, change route definition properties before registering it as a route 
server.route(_.merge(brandsGet, {
        config: {
            auth: false, // skip authentication
            // properties below are used by hapi-swagger
            description: 'Get brands',
            notes: 'Returns all the brands we are looking for',
            tags: ['api']
        }
    }))

```

```js
    // generate additional routes using routes.getById .post .patch .delete
    server.route(hh.routes.getById(brands))
    server.route(hh.routes.post(brands))
    server.route(hh.routes.patch(brands))
    server.route(hh.routes.delete(brands))
    
```
