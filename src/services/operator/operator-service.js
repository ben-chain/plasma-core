const BaseService = require('../base-service')

/**
 * Wraps functionality to pull data from the operator.
 */
class OperatorService extends BaseService {
  constructor (options) {
    super()
    this.provider = options.provider
  }

  get name () {
    return 'plasma-service'
  }

  /**
   * Returns the pending transactions to be received by address.
   * @param {*} address Address to query.
   * @return {*} List of pending transaction hashes.
   */
  getPendingTransactions (address) {
    throw new Error('Not implemented')
  }

  /**
   * Queries the operator for a specific transaction.
   * @param {*} range A coin range identifier.
   * @param {*} block Block in which this transaction should be included.
   * @return {*} A transaction, or null, along with an inclusion proof.
   */
  getTransaction (range, block) {
    // TODO: Should return null+proof or a transaction+proof
    throw new Error('Not implemented')
  }

  /**
   * Sends a transaction to the operator.
   * @param {*} transaction A transaction object.
   * @return {*} A transaction receipt from the operator.
   */
  sendTransaction (transaction) {
    return true
  }
}

module.exports = OperatorService
