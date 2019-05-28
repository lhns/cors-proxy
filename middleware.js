'use strict'
const url = require('url')
const {send} = require('micro')
const microCors = require('micro-cors')
const fetch = require('node-fetch')

const allowHeaders = [
  'accept-encoding',
  'accept-language',
  'accept',
  'access-control-allow-origin',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'dnt',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-http-method-override',
  'x-requested-with',
]
const exposeHeaders = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
  'x-github-request-id',
]
const allowMethods = [
  'POST',
  'GET',
  'OPTIONS'
]

const allow = require('./allow-request.js')

const filter = (predicate, middleware) => {
  function corsProxyMiddleware (req, res, next) {
    if (predicate(req, res)) {
      middleware(req, res, next)
    } else {
      next()
    }
  }
  return corsProxyMiddleware
}

module.exports = ({ origin, insecure_origins = [] } = {}) => {
  function predicate (req) {
    let u = url.parse(req.url, true)
    // Not a git request, skip
    return allow(req, u)
  }
  function middleware (req, res) {
    let u = url.parse(req.url, true)

    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
      return send(res, 200, '')
    }

    let headers = {}
    for (let h of allowHeaders) {
      if (req.headers[h]) {
        headers[h] = req.headers[h]
      }
    }

    let p = u.path
    let parts = p.match(/\/([^\/]*)\/(.*)/)
    let pathdomain = parts[1]
    let remainingpath = parts[2]
    let protocol = insecure_origins.includes(pathdomain) ? 'http' : 'https'

    fetch(
      `${protocol}://${pathdomain}/${remainingpath}`,
      {
        method: req.method,
        headers,
        body: (req.method !== 'GET' && req.method !== 'HEAD') ? req : undefined
      }
    ).then(f => {
      res.statusCode = f.status
      for (let h of exposeHeaders) {
        if (h === 'content-length') continue
        if (f.headers.has(h)) {
          res.setHeader(h, f.headers.get(h))
        }
      }
      f.body.pipe(res)
    })
  }
  const cors = microCors({
    allowHeaders,
    exposeHeaders,
    allowMethods,
    allowCredentials: false,
    origin
  })
  return filter(predicate, cors(middleware))
}