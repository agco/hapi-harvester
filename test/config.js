const mongodbUrl = process.env.MONGODB_URL || 'mongodb://localhost/test'
const mongodbOplogUrl = process.env.MONGODB_OPLOG_URL || 'mongodb://localhost/local'

module.exports = {
    mongodbUrl,
    mongodbOplogUrl
}