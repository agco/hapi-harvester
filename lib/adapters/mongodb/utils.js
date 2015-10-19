const Hapi = require('hapi')
const _ = require('lodash')
const Hoek = require('hoek')
const mongoose = require('mongoose')
const uuid = require('node-uuid')

module.exports = {
    getPayload: function (req) {
        return (req.payload) ? req.payload.data : {}
    }
}