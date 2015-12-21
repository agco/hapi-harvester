'use strict';

const _ = require('lodash');

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
        const plugin = require('../');
        const adapter = plugin.getAdapter('mongodb');
        server = new Hapi.Server();
        server.connection({port: options.port || 9100});
        return new Promise((resolve) => {
            server.register([require('../'), require('susie'), require('inject-then')
            ], () => {
                let harvester = server.plugins['hapi-harvester'];
                server.start(() => {
                    _.forEach(schemas, function (schema) {
                        [
                            'get',
                            'getById',
                            'getChangesStreaming',
                            'post',
                            'patch',
                            'delete'
                        ].forEach(function (verb) {
                            const route = harvester.routes[verb](schema)
                            if (_.isArray(route)) {
                                _.forEach(route, function (route) {
                                    server.route(route)
                                });
                            } else {
                                server.route(route)
                            }
                        })

                    });
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
                        resolve(err);
                    }
                })
            });
        }
    }
};

module.exports = utils;
