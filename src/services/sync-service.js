const BaseService = require('./base-service')

/**
 * Handles automatically synchronizing latest history proofs.
 */
class SyncService extends BaseService {
  constructor (options) {
    super()
    this.app = options.app
  }

  get name () {
    return 'sync-service'
  }

  async start () {
    // TODO: What happens if the client comes online later and needs to catch up?
    // TODO: Hmmm... maybe want a layer of abstraction here instead of watching events directly?
    this.app.ethService.on('event:BlockCreated', this._onBlockCreated)
  }

  async stop () {
    this.app.ethService.off('event:BlockCreated', this._onBlockCreated)
  }

  async _onBlockCreated (event) {
    await this.app.chainService.addBlockHeader(event.number, event.hash)

    // TODO: Figure out what to do if the operator tries to cheat.
    const ranges = await this.app.chainService.getOwnedRanges()
    for (let range of ranges) {
      let transaction = await this.app.operatorService.getTransaction(range, event.number)
      await this.app.chainService.addTransaction(transaction)
    }
  }
}

module.exports = SyncService
