const utils = require('plasma-utils')

const DBService = require('./services/db-service')
const JSONRPCService = require('./services/jsonrpc-service')
const RPCServerService = require('./services/rpc-server-service')
const ChainService = require('./services/chain-service')
const OperatorService = require('./services/operator/operator-service')

/**
 * Main class that runs and manages all services.
 */
class PlasmaApp {
  constructor (options) {
    this.options = options
    this.services = {}
    this.logger = new utils.logging.DefaultLogger()

    this.initServices()
    this.startServices()
  }

  /**
   * Initializes all available services.
   */
  initServices () {
    this.services.db = new DBService({
      app: this,
      db: this.options.dbBackend
    })
    this.services.rpcServer = new RPCServerService({
      app: this,
      port: this.options.rpcPort
    })
    this.services.jsonrpc = new JSONRPCService({
      app: this
    })
    this.services.chain = new ChainService({
      app: this
    })
    this.services.operator = new OperatorService({
      app: this
    })
  }

  /**
   * Starts all available services.
   */
  startServices () {
    for (let serviceId in this.services) {
      let service = this.services[serviceId]
      service.start().then(() => {
        this.logger.log(`${service.name}: OK`)
      }).catch(() => {
        // TODO: Figure out how to handle errors here.
      })
    }
  }
}

module.exports = PlasmaApp
