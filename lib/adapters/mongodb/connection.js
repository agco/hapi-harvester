const _ = require('lodash')
const mongoose = require('mongoose')

module.exports.connect = function (db, url, options) {


    return new Promise((resolve, reject) => {

        const defaults = {
            server: {
                auto_reconnect: true,
                socketOptions: {
                    keepAlive: 1,
                    connectTimeoutMS: 30000
                }
            }
        }

        db.on('error', (e) => {
            console.error(e)
        })

        db.on('open', () => {
            resolve(db)
        })

        db.open(url, _.merge(defaults, options))
    })
}


module.exports.disconnect = function (db) {
    return new Promise((resolve, reject) => {
        db.on('close', () => {
            resolve()
        })
        //clear out events
        db.base._events = {}
        db.base.disconnect()
    })
}
