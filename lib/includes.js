'use strict';

const Promise = require('bluebird'),
    _ = require('lodash'),
    $http = require('http-as-promised');

module.exports = function (adapter, schemas) {

    function appendLinkedResources(body, primaryResourceName, inclusions) {

        const primarySchema = schemas[primaryResourceName];

        function isRemote(branch, key) {
            return null != branch && null != branch.refs && null != branch.refs[key] && null != branch.refs[key].def && null != branch.refs[key].def.baseUri;
        }

        function toIncludes(map) {
            const includes = [];

            function buildRecursively(map, prefix) {
                prefix = prefix || '';
                return _.forEach(map, function (value, key) {
                    if (_.isEmpty(value)) {
                        includes.push(prefix + key);
                    } else {
                        let newPrefix = prefix + key + '.';
                        buildRecursively(value, newPrefix)
                    }
                });
            }

            buildRecursively(map);
            return includes.join(',');
        }

        function mapToInclusionTree(typeMap, schema, path) {
            path = path || [];
            const branch = _.map(typeMap, function (value, key) {
                path.push(key);
                const subBranch = buildInclusionBranch([key], schema);
                if (!_.isEmpty(value)) {
                    if (isRemote(subBranch, key)) {
                        subBranch.refs[key].def.remoteIncludes = toIncludes(value);
                    } else {
                        let schemaName = schema.relationships[key].type;
                        let subMap = mapToInclusionTree(value, schemas[schemaName], path);
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

        const inclusionMap = _.map(inclusions, function (inclusionString) {
            const result = {};
            let node = result;
            inclusionString.split('.').forEach(function (token) {
                node = node[token] = {};
            });
            return result;
        }).reduce(function (acc, node) {
            return _.merge(acc, node);
        }, {});

        const inclusionTree = mapToInclusionTree(inclusionMap, primarySchema);
        // builds a tree representation out of a series of inclusion tokens
        function buildInclusionBranch(inclusionTokens, schema) {

            const inclusionToken = _.first(inclusionTokens);
            const type = _.isArray(schema.relationships[inclusionToken]) ? schema.relationships[inclusionToken][0] : schema.relationships[inclusionToken];
            const normalisedType = _.isPlainObject(type) ? type.type : type;

            const linkDescriptor = {
                def: {type: normalisedType}
            };

            const baseUri = _.isPlainObject(type) ? type.baseUri : null;
            if (baseUri) {
                const remoteIncludes = _.drop(inclusionTokens, _.indexOf(inclusionTokens, inclusionToken) + 1).join('.');
                const remoteDescriptor = _.merge(linkDescriptor, {
                        def: {baseUri: baseUri, remoteIncludes: remoteIncludes}
                    }
                );
                return setRefs(remoteDescriptor);
            } else {
                const tokensRemaining = _.drop(inclusionTokens);
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

        const resources = _.isArray(body.data) ? body.data : [body.data];
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
        const linkedIds = getLinkedIds(resources, inclusionRefKey);
        if (linkedIds && linkedIds.length > 0) {

            const inclusionDescriptor = inclusionBranch.refs[inclusionRefKey];
            const type = inclusionDescriptor.def.type;

            fetchedIds[type] = fetchedIds[type] || [];
            const remainingIds = _.without(linkedIds, fetchedIds[type]);
            fetchedIds[type] = fetchedIds[type].concat(remainingIds);

            if (!inclusionDescriptor.def.baseUri) {
                return adapter.find(type, {query: {filter: {id: remainingIds.join(',')}}});
            } else {
                // the related resource is defined on another domain
                // fetch with an http call with inclusion of the deep linked resources for this resource
                let url = inclusionDescriptor.def.baseUri + '/' + type + '/' + remainingIds.join(',');
                if (!_.isEmpty(inclusionDescriptor.def.remoteIncludes)) {
                    url += '?include=' + inclusionDescriptor.def.remoteIncludes;
                }
                return $http(url, {json: true})
                    .spread(function (response, body) {
                        const result = body.included || [];
                        result.push(body.data);
                        return {data: result};
                    });
            }

        } else {
            return Promise.resolve();
        }
    }

    function getLinkedIds(resources, path) {
        const ids = _.reduce(resources, function (acc, resource) {
            if (resource.relationships && resource.relationships[path]) {
                let relation = resource.relationships[path];
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
        appendLinkedResources: appendLinkedResources
    }

};
