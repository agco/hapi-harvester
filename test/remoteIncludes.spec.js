'use strict';

var Joi = require('joi');
var _ = require('lodash');
var Promise = require('bluebird');
const utils = require('./utils');


describe('remote link', function () {

    var server1, server2;

    describe('given 2 resources : \'posts\', \'people\' ; defined on distinct harvesterjs servers ' +
        'and posts has a remote link \'author\' defined to people', function () {

        var app1Port = 8011;
        var app2Port = 8012;

        before(function () {

            var that = this;
            that.timeout(100000);

            var schema1 = {
                posts: {
                    type: 'posts',
                    attributes: {},
                    relationships: {
                        author: {type: 'people', baseUri: 'http://localhost:' + app2Port},
                        comments: [{type: 'comments'}],
                        topic: {type: 'topics'}
                    }
                },
                comments: {
                    type: 'comments',
                    attributes: {
                        body: Joi.string()
                    }
                },
                topics: {
                    type: 'topics',
                    attributes: {
                        name: Joi.string()
                    }
                }
            };

            var server1Promise = utils.buildServer(schema1, {port: app1Port})
                .then((res) => {
                    server1 = res.server;
                });

            var schema2 = {
                people: {
                    type: 'people',
                    attributes: {
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    relationships: {
                        country: {type: 'countries'}
                    }
                },
                countries: {
                    type: 'countries',
                    attributes: {
                        code: Joi.string()
                    }
                }
            };
            var server2Promise = utils.buildServer(schema2, {port: app2Port})
                .then((res) => {
                    server2 = res.server;
                });

            return Promise.all([server1Promise, server2Promise]).then(function () {
                    return utils.removeFromDB(server2, ['people', 'countries']);
                })
                .then(function () {
                    return utils.removeFromDB(server1, ['posts', 'comments', 'topics']);
                }).then(function () {
                    var data = {type: 'countries', attributes: {code: 'US'}};
                    return server2.injectThen({method: 'post', url: '/countries', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.countryId = response.result.data.id;
                    var data = {
                        type: 'people',
                        attributes: {firstName: 'Tony', lastName: 'Maley'},
                        relationships: {country: {type: 'countries', id: that.countryId}}
                    };
                    return server2.injectThen({method: 'post', url: '/people', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.authorId = response.result.data.id;
                    var data = {
                        type: 'comments',
                        attributes: {body: 'Nodejs Rules 1'}
                    };
                    return server1.injectThen({method: 'post', url: '/comments', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.commentId = response.result.data.id;
                    var data = {
                        type: 'posts',
                        attributes: {},
                        relationships: {author: {type: 'people', id: that.authorId}, comments: [{type: 'comments', id: that.commentId}]}
                    };
                    return server1.injectThen({method: 'post', url: '/posts', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                });
        });

        after(function () {
            var promise1 = new Promise(function (resolve) {
                utils.removeFromDB(server1, ['posts', 'comments', 'topics']).then(function () {
                    server1.stop(resolve);
                });
            });
            var promise2 = new Promise(function (resolve) {
                utils.removeFromDB(server2, ['people', 'countries']).then(function () {
                    server2.stop(resolve);
                });
            });
            return Promise.all([promise1, promise2]);
        });

        describe('fetch posts and include author', function () {
            it('should respond with a compound document with people included', function () {
                var that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=author'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        var body = response.result;
                        expect(_.pluck(body.included, 'id')).to.eql([that.authorId]);
                    });
            });
        });

        describe('fetch posts include author.country', function () {
            it('should respond with a compound document with people and countries included', function () {
                var that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=author.country'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        var body = response.result;
                        expect(_.pluck(body.included, 'id').sort()).to.eql([that.authorId, that.countryId].sort());
                    });
            });
        });

        describe('fetch posts include topic, author, author.country and comments', function () {
            it('should respond with a compound document with people, countries and comments included', function () {
                var that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=topic,comments,author,author.country'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        var body = response.result;
                        expect(_.pluck(body.included, 'id').sort()).to.eql([that.countryId, that.authorId, that.commentId].sort());
                    });
            });
        });

    });
});
