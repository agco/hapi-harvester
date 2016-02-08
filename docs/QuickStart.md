# Quick Start Guide

## Installation

It is assumed that `node.js v4` along with `npm` are already installed on your system.

Then in an new directory where you'd like your new `hapi-havester` project to live, create a new `node.js` project.

```shell
  $ npm init
```

Along with `hapi-harvester` we'll need to install a couple of other npm packages too.

```shell
  $ npm install hapi --save
  $ npm install joi --save
  $ npm install susie --save
  $ npm install hapi-havester --save
```

## Setup Docker to house MongoDB with replicasets enabled

'hapi-harvester' comes with a docker-compose.yml and some scripts to take care of setting up a dockerised MongoDB
instance with replicasets enabled. These can be found in `hapi-harvester`'s `/docker` folder. However for these scripts
to work you will need docker-compose. See [here](https://docs.docker.com/compose/install/) for help with installation.

```shell
  $ cd node_modules/hapi-harvester/docker
```

The main script to be concerned with is:

```shell
  $ ./start.sh
```

This will run several scripts to start and verify the dockerised MongoDB instance. Once finished you can connect to it
with:

```shell
  $ docker-compose run msh
```

## Server Setup

Next we'll need a server. In an `index.js` file start with the following code.

```js
  /**
   * index.js
   */
  'use strict'
  
  // dependencies
  const Hapi = require('hapi'),
      url = require('url'),
      harvester = require('hapi-harvester')
  
  
  
  //
  // Configure hapi-harvester to use our dockerised instance of MongoDB
  //
  
  // Get the docker hostname 
  const dockerHostName = url.parse(process.env.DOCKER_HOST).hostname,
  
      // use reference to docker host to create a connection URL to MongoDB
      mongoDbUrl = 'mongodb://' + dockerHostName + '/test',
      
      // use reference to docker hostname to create a connection URL to the oplog
      mongoDbOplogUrl = 'mongodb://' + dockerHostName + '/local',
      
      // configure the hapi-harvester adapter to use our dockerised MongoDB with replicasets enabled 
      adapter = harvester.getAdapter('mongodb')({
          mongodbUrl: mongoDbUrl,
          oplogConnectionString: mongoDbOplogUrl
      })
  
  
   
  // 
  // Start our hapi server with the hapi-harvester plugin
  //
  
  // create a hapi server 
  const server = new Hapi.Server()
  
  // configure the port
  server.connection({port: 3000})
  
  // we need to register the hapi-harvester plugin before we can use it
  server.register([
      {
          register: harvester, // the hapi-harvester plugin "required" from above
          options: {
              adapter: adapter // use the MongoDB adapter created above
          }
      } ],
      () => {
      
          // once the callback has been registered we can start the server
          server.start(() => {
              console.log('Using MongoDB instance at:', mongoDbUrl)
              console.log('Server running at:', server.info.uri)
          })
      })

```

To start the server, in a shell use:

```shell
  $ node index.js
```

This should start the server and connect to the MongoDB instance that's running inside a docker container. However there
are no routes defined so it's not particularly useful yet.

## Schema Setup

The last thing we need to do is define a Schema for some models and add some default REST routes.

We will use `joi` for attribute validation so we need to require that module.

```js
...
const Hapi = require('hapi'),
    Joi = require('joi'),
    url = require('url'),
    harvester = require('hapi-harvester')
...
```

Then in the callback after registering the plugins we can define our the schemas for our models and add routes to the
the hapi server.

```js
...
server.register([
    {
        register: harvester, // the hapi-harvester plugin "required" from above
        options: {
            adapter: adapter // use the MongoDB adapter created above
        }
    } ],
    () => {

        //
        // Here we can define our schema and default routes
        //

        // first we need to define a schema for our model, using Joi for validation
        const brandSchema = {
            type: 'brands',
            attributes: {
                code: Joi.string(),
                description: Joi.string()
            }
        }

        // next we need a reference to our plugin so we can add routes.
        const harvesterPlugin = server.plugins['hapi-harvester']

        // Using hapi-harvester's routes.all function we can add our schema and
        // then add all routes for our model to the hapi server.
        harvesterPlugin.routes.all(brandSchema).forEach((route) => {
            server.route(route)
        })


        // finally we can start the server
        server.start(() => {
            console.log('Using MongoDB at:', mongoDbUrl)
            console.log('Server running at:', server.info.uri)
        })
    })
...
```

A complete listing of code can be found in the `/example` directory.

Now that we've added models to our server we can restart the server and try them out.

```js
  $node index.js
```

Then in a browser, open:

```
  http://localhost:3000/brands
```

And we should get a response from the server like this:

```
  {"data":[]}
```

Not very exciting as we don't have any data yet. So lets do that now. Again using `curl` in a terminal, we can add data.

```shell
  $ curl -X "POST" "http://localhost:3000/brands" \
    -H "Content-Type: application/json" \
    -d $'{ "data": { "type": "brands", "attributes": { "code": "MF", "description": "Massey Ferguson" } } }'
```

Now when we refresh the browser, we get:

```
  {"data":[{"type":"brands","attributes":{"code":"MF","description":"Massey Ferguson"},"id":"8ab18ce6-0811-4a92-a686-c4124921eda1"}]}
```

But that's not all, say we switched brands and need to update our backend. Using `curl`, we can edit our data.

```
  $ curl -X "PATCH" "http://localhost:3000/brands/8ab18ce6-0811-4a92-a686-c4124921eda1" \
    -H "Content-Type: application/json" \
    -d $'{ "data": { "type": "brands", "attributes": { "code": "VT", "description": "Viltra" } } }'
```

Now if we refresh the browser again, we get:

```
  {"data":[{"type":"brands","attributes":{"description":"Viltra","code":"VT"},"id":"8ab18ce6-0811-4a92-a686-c4124921eda1"}]}
```

Finally we can delete this record too. Again using `curl`, we can issue the following command:

```
  $ curl -X "DELETE" "http://localhost:3000/brands/8ab18ce6-0811-4a92-a686-c4124921eda1" \
    -H "Content-Type: application/json"
```

And after refreshing the browser, we're back to were we started, with no records in the database.

```
  {"data":[]}
```



## Bonus: SSE streaming


Adding SSE stream of change events is very easy. First we need to require the `susie` a hapi plugin that adds SSE's to 
a hapi server.

```js
  ...
  const Hapi = require('hapi'),
      Joi = require('joi'),
      url = require('url'),
      harvester = require('hapi-harvester'),
      susie = require('susie')                // for SSE 
  ...

```

Then add it to the list of registered modules like so...

```js
  ...
  server.register([
      {
          register: harvester, // the hapi-harvester plugin "required" from above
          options: {
              adapter: adapter // use the MongoDB adapter created above
          }
      },
      
      // also require susie for streaming SSEs
      susie ],
      () => {
        ...
      })
  ...    
```

And that's it. It's that simple. To connect to the stream, in a shell use the following `curl` command:

```shell
  $ curl -X "GET" "http://localhost:3000/brands/changes/streaming"
```

And at the very least you should see some "ticker" events every 5 seconds. for example:

```shell
  ...
  event: ticker
  id: 170
  data: 170
  ...
```
