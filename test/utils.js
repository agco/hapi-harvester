'use strict';

const _ = require('lodash');
const config = require('./config');

var utils = {
    getData: (res) => {
        const data = res.result.data;
        return _.omit(data, 'id')
    },
    removeFromDB: (server, collections) => {
        var promises = _.map(collections, function (item) {
            const model = server.plugins['hapi-harvester'].adapter.models[item];
            return model.remove({}).lean().exec();
        });
        return Promise.all(promises);
    },
    buildServer: (schemas, options) => {
        options = options || {};
        let server;
        const Hapi = require('hapi');

        const harvester = require('../');
        const mongodbAdapter = harvester.getAdapter('mongodb')
        const mongodbSSEAdapter = harvester.getAdapter('mongodb/sse')

        server = new Hapi.Server();
        server.connection({port: options.port || 9100});
        return new Promise((resolve) => {
            server.register([{
                register: harvester,
                options: {
                    adapter: mongodbAdapter(config.mongodbUrl),
                    adapterSSE: mongodbSSEAdapter(config.mongodbOplogUrl)
                }
            }, require('susie'), require('inject-then')
            ], () => {
                let harvester = server.plugins['hapi-harvester'];
                server.start(() => {
                    _.forEach(schemas, function (schema) {
                        const routes = harvester.routes.all(schema)
                        _.forEach(routes, (route) => server.route(route))
                    });
                    server.route(harvester.routes.getChangesStreaming())
                    resolve({server, harvester})
                })
            })
        });
    },
    buildDefaultServer: function (schemas) {
        return utils.buildServer(schemas).then(function (res) {
            global.server = res.server;
            global.harvester = res.harvester;
            return res.server;
        });
    },
    createDefaultServerDestructor: function () {
        return function () {
            return new Promise(function (resolve, reject) {
                server.stop(function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            });
        }
    }
};

module.exports = utils;
