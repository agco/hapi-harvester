const _ = require('lodash')
const mongoose = require('mongoose')

module.exports.connect = function (url, options) {

    return new Promise((resolve, reject) => {

        const db = mongoose.createConnection(url, options)

        db.on('error', (e) => {
            console.error(e)
        })

        db.on('open', () => {
            resolve(db)
        })
    })
}


module.exports.disconnect = function (db) {
    return new Promise((resolve, reject) => {
        // do not wait on disconnect if not connected
        if(db.base.connections[0] && db.base.connections[0]._readyState === 0) {
            return resolve()
        }

        db.on('close', () => {
            resolve()
        })
        //clear out events
        db.base._events = {}
        db.base.disconnect()
    })
}
