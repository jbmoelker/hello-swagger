const service = require('./service')
const { validate } = require('./validator')

module.exports = validate('./schema.yaml', service)