var _ = require('lodash');
var Promise = require('bluebird');

/**
 * Configure seeding service.
 *
 * Sample usage:
 *
 * seed(harvesterInstance).seed('pets','people').then(function(ids){});
 *
 * @param harvesterInstance harvester instance that will be used to access database
 * @returns {{dropCollectionsAndSeed: Function}} configured seeding service
 */
module.exports = function (harvesterInstance) {

    function post(key, items) {
        return _(items).map(function (item) {
            return harvesterInstance.injectThen({method: 'post', url: '/' + key, payload: {data: item}}).then(function (response) {
                if (response.statusCode !== 201) {
                   console.log(JSON.stringify(response.result, null, '  '));
                }
                expect(response.statusCode).to.equal(201);
                return response.result.data.id;
            });
        }).thru(Promise.all)
            .value()
            .then(function (result) {
                return {[key]: result}
            });
    }

    function drop(collectionName) {
        var model = harvesterInstance.plugins['hapi-harvester'].adapter.models[collectionName];
        if (model) {
            return model.remove({}).lean().exec();
        } else {
            return Promise.resolve();
        }
    }

    /**
     * Drop collections whose names are specified in vararg manner.
     *
     * @returns {*} array of collection names
     */
    function dropCollections() {
        if (0 === arguments.length) {
            throw new Error('Collection names must be specified explicitly');
        }
        var collectionNames = arguments;
        var promises = _.map(collectionNames, function (collectionName) {
            return drop(collectionName);
        });
        return Promise.all(promises).then(function () {
            return collectionNames;
        });
    }

    function dropCollectionsAndSeed(fixtures) {
        return dropCollections.apply(null, _.keys(fixtures)).then(function () {
            var promises = _.map(fixtures, function (fixture, collectionName) {
                return post(collectionName, fixture);
            });
            return Promise.all(promises)
        }).then(function (result) {
            var response = {};
            _.forEach(result, function (item) {
                _.extend(response, item);
            });
            return response;
        });
    }

    function seed(schema) {
        var promises = _.map(schema, function (fixture, collectionName) {
            return post(collectionName, fixture);
        });
        return Promise.all(promises).then(function (result) {
            var response = {};
            _.forEach(result, function (item) {
                _.extend(response, item);
            });
            return response;
        });
    }

    if (null == harvesterInstance) {
        throw new Error('Harvester instance is required param');
    }

    return {
        seed: seed,
        dropCollections: dropCollections,
        dropCollectionsAndSeed: dropCollectionsAndSeed
    }
};
