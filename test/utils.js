'use strict';

var _ = require('lodash');

var utils = {
    getData: (res) => {
        const data = res.result.data;
        return _.omit(data, 'id')
    },
    removeFromDB: (server, collections) => {
        var promises = _.map(collections, function (item) {
            const model = server.plugins.harvester.adapter.models[item];
            return model.remove({}).lean().exec();
        });
        return Promise.all(promises);
    },
    buildServer: (schemas, options) => {
        options = options || {};
        let server, hh;
        const Hapi = require('hapi');
        const plugin = require('../');
        const adapter = plugin.getAdapter('mongodb');
        server = new Hapi.Server();
        server.connection({port: options.port || 9100});
        return new Promise((resolve) => {
            server.register([
                {register: require('../'), options: {adapter: adapter({mongodbUrl: 'mongodb://localhost/test'})}},
                {register: require('inject-then')}
            ], () => {
                hh = server.plugins.harvester;
                server.start(() => {
                    _.forEach(schemas, function (schema) {
                        ['get', 'getById', 'post', 'patch', 'delete'].forEach(function (verb) {
                            server.route(hh.routes[verb](schema))
                        })
                    });
                    resolve({server, hh})
                })
            })
        });
    },
    buildDefaultServer: function (schemas) {
        return utils.buildServer(schemas).then(function (res) {
            global.server = res.server;
            global.hh = res.hh;
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
