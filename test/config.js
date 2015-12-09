const url = require('url')

module.exports.getMongodbUrl = (db) => {
    const mongodburl = process.env.MONGODB_URL
    if (mongodburl) {
        return mongodburl
    } else {
        const dockerHostUrl = process.env.DOCKER_HOST
        if (dockerHostUrl) {
            return `mongodb://${url.parse(dockerHostUrl).hostname}:27017/${db}`
        } else {
            return `mongodb://localhost:27017/${db}`
        }
    }
}
