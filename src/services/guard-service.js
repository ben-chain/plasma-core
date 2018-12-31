const BaseService = require('./base-service')

/**
 * Watches for invalid exits and automatically starts challenges.
 */
class GuardService extends BaseService {
  constructor (options) {
    super()

    this.app = options.app
  }

  get name () {
    return 'guard-service'
  }

  async start () {
    this.app.services.eth.on('event:ExitStarted', this._onExitStarted)
  }

  async stop () {
    this.app.services.eth.off('event:ExitStarted', this._onExitStarted)
  }

  /**
   * Handles an ExitStarted event and starts a challenge if the exit is invalid.
   * @param {*} event ExitStarted event to be handled.
   */
  _onExitStarted (event) {
    // TODO: Check if the token being exited belongs to the user.
    // TODO: Submit a challenge if someone is trying to steal the user's funds.
    // TODO: Figure out what type of challenge needs to be submitted.
    throw new Error('Not implemented')
  }
}

module.exports = GuardService
