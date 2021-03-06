const BaseService = require('./base-service')

/**
 * Returns all the functions of a given class instance
 * @param {*} instance Class instance to be queried.
 * @param {*} ignore Names of functions to ignore.
 * @param {*} prefix A prefix to be added to each function.
 * @returns {Object} An object that maps function names to functions.
 */
const getAllFunctions = (instance, ignore = [], prefix = '') => {
  let fns = {}
  Object.getOwnPropertyNames(instance.constructor.prototype).forEach((prop) => {
    if (!ignore.includes(prop)) {
      fns[prefix + prop] = instance[prop]
    }
  })
  return fns
}

const JSONRPC_ERRORS = {
  'PARSE_ERROR': {
    code: -32700,
    message: 'Parse error'
  },
  'INVALID_REQUEST': {
    code: -32600,
    message: 'Invalid request'
  },
  'METHOD_NOT_FOUND': {
    code: -32601,
    message: 'Method not found'
  },
  'INVALID_PARAMS': {
    code: -32602,
    message: 'Invalid params'
  },
  'INTERNAL_ERROR': {
    code: -32603,
    message: 'Internal error'
  }
}

/**
 * Service that handles and responds to JSON-RPC requests.
 */
class JSONRPCService extends BaseService {
  constructor (options) {
    super()

    this.subdispatchers = [new ChainSubdispatcher()]
  }

  get name () {
    return 'jsonrpc-service'
  }

  /**
   * Returns all methods of all subdispatchers.
   * @returns {Object} All subdispatcher methods as a single object.
   */
  getAllMethods () {
    return this.subdispatchers.map((subdispatcher) => {
      return subdispatcher.getMethods()
    }).reduce((pre, cur) => {
      return { ...pre, ...cur }
    })
  }

  /**
   * Returns a single method.
   * @param {*} name Name of the method to return.
   * @returns {function} The method with the given name or
   * `undefined` if the method does not exist.
   */
  getMethod (name) {
    const methods = this.getAllMethods()
    if (name in methods) {
      return methods[name]
    }
  }

  /**
   * Calls the method with the given name and parameters.
   * @param {*} name Name of the method to call.
   * @param {*} params Parameters to be used as arguments to the method.
   * @returns {*} Result of the function call.
   */
  async callMethod (name, params) {
    const method = this.getMethod(name)
    return method(...params)
  }

  /**
   * Handles a raw (JSON) JSON-RPC request.
   * @param {*} jsonRequest A stringified JSON-RPC request.
   * @returns {*} Result of the JSON-RPC call.
   */
  async handle (jsonRequest) {
    let request
    try {
      request = JSON.parse(jsonRequest)
    } catch (err) {
      return this._buildError('PARSE_ERROR', null)
    }

    if (!(request.method && request.params && request.id)) {
      return this._buildError('INVALID_REQUEST', null)
    }

    if (!this.getMethod(request.method)) {
      return this._buildError('METHOD_NOT_FOUND', request.id)
    }

    let result
    try {
      result = this.callMethod(request.method, request.params)
    } catch (err) {
      return this._buildError('INTERNAL_ERROR', request.id)
    }

    return JSON.stringify({
      jsonrpc: '2.0',
      result: result,
      id: request.id
    })
  }

  /**
   * Builds a JSON-RPC error response.
   * @param {*} type Error type.
   * @param {*} id RPC command ID.
   * @returns {Object} A stringified JSON-RPC error response.
   */
  _buildError (type, id) {
    return JSON.stringify({
      jsonrpc: '2.0',
      error: JSONRPC_ERRORS[type],
      id: id
    })
  }
}

/**
 * Base class for JSON-RPC subdispatchers that handle requests.
 */
class Subdispatcher {
  /**
   * Returns the JSON-RPC prefix of this subdispatcher.
   */
  get prefix () {
    throw new Error('Classes that extend Subdispatcher must implement this method')
  }

  /**
   * Returns all JSON-RPC methods of this subdispatcher.
   */
  getMethods () {
    const ignore = ['constructor', 'prefix']
    return getAllFunctions(this, ignore, this.prefix)
  }
}

/**
 * Subdispatcher that handles chain-related requests.
 */
class ChainSubdispatcher extends Subdispatcher {
  get prefix () {
    return 'pg_'
  }

  getBalance (address) {
    throw new Error('Not implemented')
  }

  getBlock (block) {
    throw new Error('Not implemented')
  }
}

module.exports = JSONRPCService
