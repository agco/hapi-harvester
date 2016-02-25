'use strict';

const Joi = require('joi');
const _ = require('lodash');
const Promise = require('bluebird');
const utils = require('./utils');


describe('remote link', function () {

    let server1, server2;

    describe('given 2 resources : \'posts\', \'people\' ; defined on distinct harvester servers ' +
        'and posts has a remote link \'author\' defined to people', function () {

        const app1Port = 8011;
        const app2Port = 8012;

        before(function () {

            const that = this;
            that.timeout(100000);

            const schema1 = {
                posts: {
                    type: 'posts',
                    attributes: {},
                    relationships: {
                        author: {
                            data: {type: 'people', baseUri: 'http://localhost:' + app2Port}
                        },
                        comments: {
                            data: [{type: 'comments'}]
                        },
                        topic: {
                            data: {type: 'topics'}
                        }
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

            const server1Promise = utils.buildServer(schema1, {port: app1Port})
                .then((res) => {
                    server1 = res.server;
                });

            const schema2 = {
                people: {
                    type: 'people',
                    attributes: {
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    relationships: {
                        country: {
                            data: {type: 'countries'}
                        }
                    }
                },
                countries: {
                    type: 'countries',
                    attributes: {
                        code: Joi.string()
                    }
                }
            };
            const server2Promise = utils.buildServer(schema2, {port: app2Port})
                .then((res) => {
                    server2 = res.server;
                });

            return Promise.all([server1Promise, server2Promise]).then(function () {
                    return utils.removeFromDB(server2, ['people', 'countries']);
                })
                .then(function () {
                    return utils.removeFromDB(server1, ['posts', 'comments', 'topics']);
                }).then(function () {
                    const data = {type: 'countries', attributes: {code: 'US'}};
                    return server2.injectThen({method: 'post', url: '/countries', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.countryId = response.result.data.id;
                    const data = {
                        type: 'people',
                        attributes: {firstName: 'Tony', lastName: 'Maley'},
                        relationships: {
                          country: {
                            data: {type: 'countries', id: that.countryId}
                          }
                        }
                    };
                    return server2.injectThen({method: 'post', url: '/people', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.authorId = response.result.data.id;
                    const data = {
                        type: 'comments',
                        attributes: {body: 'Nodejs Rules 1'}
                    };
                    return server1.injectThen({method: 'post', url: '/comments', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                    that.commentId = response.result.data.id;
                    const data = {
                        type: 'posts',
                        attributes: {},
                        relationships: {
                            author: {
                              data: {type: 'people', id: that.authorId}
                            },
                            comments: {
                              data: [{type: 'comments', id: that.commentId}]
                            }
                        }
                    };
                    return server1.injectThen({method: 'post', url: '/posts', payload: {data: data}});
                }).then(function (response) {
                    expect(response.statusCode).to.equal(201);
                }).catch((e) => {
                  console.error('Caught error starting server', e);
                });
        });

        after(function () {
            const promise1 = new Promise(function (resolve) {
                // TODO: calling removeFromDB causes after() to timeout, so i've commented it out
                // Still not sure what the root cause of this is though.
                //utils.removeFromDB(server1, ['posts', 'comments', 'topics']).then(function () {
                    server1.stop(resolve);
                //});
            });
            const promise2 = new Promise(function (resolve) {
                // TODO: calling removeFromDB causes after() to timeout, so i've commented it out
                // Still not sure what the root cause of this is though.
                //utils.removeFromDB(server2, ['people', 'countries']).then(function () {
                    server2.stop(resolve);
                //});
            });
            return Promise.all([promise1, promise2]);
        });

        describe('fetch posts and include author', function () {
            it('should respond with a compound document with people included', function () {
                const that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=author'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        const body = response.result;
                        expect(_.pluck(body.included, 'id')).to.eql([that.authorId]);
                    });
            });
        });

        describe('fetch posts include author.country', function () {
            it('should respond with a compound document with people and countries included', function () {
                const that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=author.country'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        const body = response.result;
                        expect(_.pluck(body.included, 'id').sort()).to.eql([that.authorId, that.countryId].sort());
                    });
            });
        });

        describe('fetch posts include topic, author, author.country and comments', function () {
            it('should respond with a compound document with people, countries and comments included', function () {
                const that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=topic,comments,author,author.country'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(200);
                        const body = response.result;
                        expect(_.pluck(body.included, 'id').sort()).to.eql([that.countryId, that.authorId, that.commentId].sort());
                    });
            });
        });

        describe('fetch posts include topic, author, author.country and comments when remote relationship is missing', function () {
            before(function () {
                const data = {
                    type: 'posts',
                    attributes: {},
                    relationships: {
                      comments: {
                        data: [{type: 'comments', id: '00000000-0000-4000-b000-000000000000'}]
                      }
                    }
                };
                return server1.injectThen({method: 'post', url: '/posts', payload: {data: data}}).then(function (result) {
                    expect(result.statusCode).to.equal(201)
                })
            });
            it('should respond with 500', function () {
                const that = this;
                return server1.injectThen({method: 'get', url: '/posts?include=comments'})
                    .then(function (response) {
                        expect(response.statusCode).to.equal(500);
                    });
            });
        });

    });
});
