const { send } = require('micro')
const { parse: parseUrl } = require('url')

module.exports = async (req, res) => {
    const { query } = parseUrl(req.url, true)
    send(res, 200, { hello: query.name })
}