var Promise = require('bluebird'),
    _ = require('lodash'),
    $http = require('http-as-promised');

module.exports = function (adapter, schemas) {

    function linked(body, primaryResourceName, inclusions) {

        var primarySchema = schemas[primaryResourceName];

        function isRemote(branch, key) {
            return null != branch && null != branch.refs && null != branch.refs[key] && null != branch.refs[key].def && null != branch.refs[key].def.baseUri;
        }

        function toIncludes(map) {
            var includes = [];

            function buildRecursively(map, prefix) {
                prefix = prefix || '';
                return _.forEach(map, function (value, key) {
                    if (_.isEmpty(value)) {
                        includes.push(prefix + key);
                    } else {
                        var newPrefix = prefix + key + '.';
                        buildRecursively(value, newPrefix)
                    }
                });
            }

            buildRecursively(map);
            return includes.join(',');
        }

        function mapToInclusionTree(typeMap, schema, path) {
            path = path || [];
            var branch = _.map(typeMap, function (value, key) {
                path.push(key);
                var subBranch = buildInclusionBranch([key], schema);
                if (!_.isEmpty(value)) {
                    if (isRemote(subBranch, key)) {
                        subBranch.refs[key].def.remoteIncludes = toIncludes(value);
                    } else {
                        var schemaName = schema.relationships[key].type;
                        var subMap = mapToInclusionTree(value, schemas[schemaName], path);
                        _.merge(subBranch.refs[key], subMap);
                    }
                }
                path.pop();
                return subBranch;
            });
            return _.reduce(branch, function (acc, item) {
                return _.merge(acc, item);
            }, {});
        }

        var inclusionMap = _.map(inclusions, function (inclusionString) {
            var result = {};
            var node = result;
            inclusionString.split('.').forEach(function (token) {
                node = node[token] = {};
            });
            return result;
        }).reduce(function (acc, node) {
            return _.merge(acc, node);
        }, {});

        var inclusionTree = mapToInclusionTree(inclusionMap, primarySchema);
        // builds a tree representation out of a series of inclusion tokens
        function buildInclusionBranch(inclusionTokens, schema) {

            var inclusionToken = _.first(inclusionTokens);
            var type = _.isArray(schema.relationships[inclusionToken]) ? schema.relationships[inclusionToken][0] : schema.relationships[inclusionToken];
            var normalisedType = _.isPlainObject(type) ? type.type : type;

            var linkDescriptor = {
                def: {type: normalisedType}
            };

            var baseUri = _.isPlainObject(type) ? type.baseUri : null;
            if (baseUri) {
                var remoteIncludes = _.drop(inclusionTokens, _.indexOf(inclusionTokens, inclusionToken) + 1).join('.');
                var remoteDescriptor = _.merge(linkDescriptor, {
                        def: {baseUri: baseUri, remoteIncludes: remoteIncludes}
                    }
                );
                return setRefs(remoteDescriptor);
            } else {
                var tokensRemaining = _.drop(inclusionTokens);
                if (tokensRemaining.length == 0) {
                    return setRefs(linkDescriptor);
                } else {
                    return _.merge(linkDescriptor, buildInclusionBranch(tokensRemaining, schemas[normalisedType]));
                }
            }

            function setRefs(descriptor) {
                return _.set({}, 'refs.' + inclusionToken, descriptor);
            }

        }

        var resources = body.data;
        return fetchLinked({}, resources, inclusionTree)
            .then(function (linked) {
                body.included = linked;
                return body;
            });

    }

    function fetchLinked(fetchedIds, resources, inclusionBranch) {
        return Promise
            .all(_.map(_.keys(inclusionBranch ? inclusionBranch.refs : []), function (inclusionRefKey) {
                return fetchResources(fetchedIds, resources, inclusionBranch, inclusionRefKey)
                    .then(function (result) {
                        if (result && result.data) {
                            return fetchLinked(fetchedIds, result.data, inclusionBranch.refs[inclusionRefKey]).then(function (subResult) {
                                return _.union(result.data, subResult);
                            });
                        } else {
                            return [];
                        }
                    });
            }))
            .then(function (linkedResources) {
                return _.reduce(linkedResources, function (acc, linkedResource) {
                    return _.union(acc, linkedResource);
                }, []);
            });
    }

    function fetchResources(fetchedIds, resources, inclusionBranch, inclusionRefKey) {
        var linkedIds = getLinkedIds(resources, inclusionRefKey);
        if (linkedIds && linkedIds.length > 0) {

            var inclusionDescriptor = inclusionBranch.refs[inclusionRefKey];
            var type = inclusionDescriptor.def.type;

            fetchedIds[type] = fetchedIds[type] || [];
            var remainingIds = _.without(linkedIds, fetchedIds[type]);
            fetchedIds[type] = fetchedIds[type].concat(remainingIds);

            var resourceName = type;

            if (!inclusionDescriptor.def.baseUri) {
                return adapter.find(type, {query: {filter: {id: remainingIds.join(',')}}});
            } else {
                // the related resource is defined on another domain
                // fetch with an http call with inclusion of the deep linked resources for this resource
                return $http(inclusionDescriptor.def.baseUri + '/' + resourceName + '?id=' + remainingIds.join(',') +
                    '&include=' + inclusionDescriptor.def.remoteIncludes, {json: true})
                    .spread(function (response, body) {
                        // get results for the primary resource
                        var primary = _.set({}, resourceName, body[resourceName]);
                        return _.reduce(body.included, function (accum, val, key) {
                            // accumulate results for the linked resources
                            return _.set(accum, key, val);
                        }, primary);
                    });
            }

        } else {
            return Promise.resolve();
        }
    }

    function getLinkedIds(resources, path) {
        var ids = _.reduce(resources, function (acc, resource) {
            if (resource.relationships && resource.relationships[path]) {
                var relation = resource.relationships[path];
                if (_.isArray(relation)) {
                    acc = acc.concat(relation.map(function (item) {
                        return item.id;
                    }));
                } else {
                    acc.push(relation.id);
                }
            }
            return acc;

        }, []);

        return _.uniq(ids);
    }


    return {
        linked: linked
    }

};
