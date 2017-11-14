const contentType = require('content-type')
const ParameterParser = require('swagger-parameters')
const { parse: parseUrl } = require('url')
const { promisify } = require('util')
const { send } = require('micro')
const SwaggerParser = require('swagger-parser')
const tv4 = require('tv4')

const isProduction = (process.env.NODE_ENV === 'production')


function validate (filename, service) {
    return async (req, res) => {
        try {
            const schema = await SwaggerParser.dereference(filename)
            const schemaForRequest = await validateRequest(schema, req)
            await service(req, res)
            validateResponseType(schema, res)
            validateResponse(schemaForRequest.responses, res)
        } catch (err) {
            return send(res, err.statusCode, err)
        }
    }
}

// use micro's built-in errors? https://github.com/zeit/micro#createerrorcode-msg-orig
function RouteNotFoundError (route) {
    this.statusCode = 404
    this.message = `Route ${route} not found`
}

function MethodNotAllowedError (method, allowedMethods) {
    this.statusCode = 405
    this.message = `Method ${method} not allowed. Allowed methods: ${allowedMethods.join(', ')}.`
}

function InvalidContentTypeError (contentType) {
    this.statusCode = 500
    this.message = `Service produced an invalid content type (${contentType})`
}

function InvalidParameterError (errors) {
    this.statusCode = 400
    this.message = `Request has invalid parameter(s)`
    this.errors = errors // @todo format errors
}

function InvalidProtocolError (protocol, allowedProtocols) {
    this.statusCode = 403
    this.message = `Protocol ${protocol} not allowed. Allowed protocols: ${allowedProtocols.join(', ')}.`
}

async function validateRequest (schema, req) {
    validateRequestScheme(schema, req)

    const matchingPath = matchRequestPath(schema, req)
    const schemaForPath = schema.paths[matchingPath]

    const method = req.method.toLowerCase()
    validateRequestMethod(schemaForPath, req)

    const schemaForRequest = schemaForPath[method]
    await validateRequestParameters(schemaForRequest.parameters, req)

    return schemaForRequest
}

/**
 * @todo also account for req.headers['x-forwarded-proto'] ? (https://stackoverflow.com/a/42358516)
 */
function validateRequestScheme (schema, req) {
    const { host } = req.headers
    const scheme = req.connection.encrypted ? 'https' : 'http'
    const supportedSchemes = schema.schemes
    if (!supportedSchemes.includes(scheme) && isProduction) {
        throw new InvalidProtocolError(scheme, supportedSchemes)
    }
}

/**
 * @todo take `basePath` into account?
 * @todo match path templates 
 * @see https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#paths-object
 */
function matchRequestPath (schema, req) {
    const { pathname } = parseUrl(req.url, true)
    if (!schema.paths.hasOwnProperty(pathname)) {
        throw new RouteNotFoundError(pathname)
    }
    return pathname
}

function validateRequestMethod (schemaForPath, req) {
    const method = req.method.toLowerCase()
    const allowedMethods = Object.keys(schemaForPath)
    if (!allowedMethods.includes(method)) {
        throw new MethodNotAllowedError(method, allowedMethods)
    }
}

/**
 * Validate Request Parameters
 * @todo validate path and header parameters
 * @see https://www.npmjs.com/package/swagger-parameters#usage
 */
function validateRequestParameters (schema, req) {
    const parseParameters = promisify(ParameterParser(schema))
    const { query } = parseUrl(req.url, true)
    let parameters = { 
        headers: {},
        path: {},
        query
    }
    return parseParameters(parameters)
        .catch(err => {
            throw new InvalidParameterError(err.errors)
        })
}

/**
 * @todo validate using https://www.npmjs.com/package/tv4
 */
function validateResponse (schema, res) {
    const { statusCode } = res
    const supportedStatusCodes = Object.keys(schema).filter(code => code !== 'default')
    let responseSchema
    if (supportedStatusCodes.includes(`${statusCode}`)) {
        responseSchema = schema[`${statusCode}`].schema
    } else if (schema.hasOwnProperty('default')) {
        responseSchema = schema.default.schema
    } else {
        console.log('Error: no schema to handle response')
    }
    console.log('@todo validate res using schema')
    console.log(res.statusCode, JSON.stringify(responseSchema))
}

function validateResponseType (schema, res) {
    const allowedTypes = schema.produces
    const { type } = contentType.parse(res.getHeader('content-type'))
    if (!allowedTypes.includes(type)) {
        throw new InvalidContentTypeError(type)
    }
}

module.exports = { validate }
