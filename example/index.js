/**
 * index.js
 */
'use strict'

// dependencies
const Hapi = require('hapi'),
    Joi = require('joi'),
    url = require('url'),
    harvester = require('hapi-harvester'),
    susie = require('susie')



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
    },
    susie ],  // for streaming SSE
    () => {

        //
        // Defining a model and default routes
        //

        // first we need to define a schema for our model, using Joi for
        // validation
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
