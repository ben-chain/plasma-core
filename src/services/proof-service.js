const BaseService = require('./base-service')
const BN = require('web3').utils.BN
const _ = require('lodash')
const PlasmaMerkleSumTree = new require('./sum-tree')
const ST = new PlasmaMerkleSumTree()

class ProofSerivce extends BaseService {
  get name () {
    return 'proof-service'
  }

  //TODO: replace start and ends with typedstarts and typedends

  checkNewTransactionProof (transaction, history) {
    const deposits = getMostRecentDeposits(range)
    return checkHistoryProofFromSnapshot(transaction, history, deposits)
  }

  // history form: history[TRIndex(of Transaction being checked)][relevantSnapshotInd][block][i] = {ith relevant tx, ITS transferIndex, [its tree indexes], [its [branches]]}
  // ^ AKA history[TRIndex] = subHistory with subHistory[relevantSnapshotInd][block][i] = as above
  checkHistoryProofFromSnapshot (transaction, history, snapshots) {
    if (!checkValidHistoryFromSnapshots(transaction, history, snapshots)) return false
    //TODO: make sure no trickery with sender or recipient = 0x0000000...
    for (let i = 0; i < transaction.transfers.length; i++) { // for each send in the TX
      const transfer = transaction.transfers[i] // the particular TR
      let trHistory = history[i] // history for this particular TR
      const sender = transfer.sender
      const subRange = {start: transfer.start, end: transfer.end}
      const relevantSnapshots = getOverlappingSnapshots(snapshots, transfer)
      for (let i = 0; i < relevantSnapshots.length; i++) {
        const snapshot = relevantSnapshots[i]
        const snapshotHistory = trHistory[i]
        snapshotHistory.toBlock = transaction.block // the block the history goes "up to" -- the transaction's block!
        owner = checkSnapshotSubrangeOwner(snapshot, subRange, snapshotHistory)
        if (owner !== sender) return false
      }
    }
    return true
  }

  //TODO check root sum is ffffff...
  //TODO: check transaction inclusion in the block or decide to handle that before inputting here
  //TODO break into more functions lololol
  checkValidHistoryFromSnapshots (transaction, history, snapshots) {
    if (!history || !transaction || !snapshots) return false // something's missing
    if (transaction.transfers.length !== history.length) return false // as many entries as TRs being covered from history
    for (let i = 0; i < transaction.transfers.length; i++) { // for each transfer in the TX we're ultimately verifying...
      const trHistory = history[i]
      const relevantSnapshots = getOverlappingSnapshots(snapshots, transaction.transfers[i])
      if (relevantSnapshots.length !== trHistory.length) return false 
      for (let j = 0; j < relevantSnapshots.length; j++) { // for each snapshot intersecting that transfer...
        const snapshot = relevantSnapshots[j]
        const snapshotHistory = trHistory[j]
        for (let block = snapshot.block; k < transaction.block; k++) { // for each block in the snapshot history
          const blockProofs = snapshotHistory[block] // the proofs for that snapshot, in this block
          let expectedLeafIndex = blockProofs[0].leafIndices[blockProofs[0].TRIndex]
          for (let k = 0; k < blockProofs.length; k++) {
            const proof = blockProofs[k] // the proofs for each transaction in the b
            if (proof.leafIndices[proof.TRIndex] !== expectedLeafIndex) return false // not sequential leaves of block tree!
            expectedLeafIndex++
            if (!checkTransactionIncludedAndWellFormed(proof, block)) return false
          }
        }
      }
    }
    return true
  }

  getOverlappingSnapshots(snapshots, transfer) {
    // todo implement
  }


  // this does the check the smart contract will do to confirm transaction validity.
  // takes in proof = {transaction, TRIndex, [leafIndices], [branches]}
  checkTransactionIncludedAndWellFormed(proof, block) {    // proof = {ith relevant tx, ITS transferIndex, [its tree indexes], [its [branches]]}
  const firstBranchLength = proof.branches[0].length
  for (let branch in proof.branches) if (branch.length !== firstBranchLength) return false //proofs must be equal length
  const root = getBlockRoot(block) // TODO hardcode or integrate into ETHservice
  for (let i = 0; i < proof.leafIndices.length; i++) { // todo make sure we don't iterate over proof.branches.length elsewhere, this could result in a vuln?
      const branch = proof.branches[i]
      //todo checks on indexbitstring.length <= proof length, proof not empty, proof divides 2
      const index = new BN(proof.leafIndices[i]).toString(2, firstBranchLength / 2) // path bitstring
      const path = index.split("").reverse().join("") // reverse ordering so we start with the bottom
      let encoding = proof.transaction.encode()
      encoding = '0x' + new BN(encoding).toString(16, 2 * encoding.length)
      const leafParent = (path[0] == '0') ? branch[0] : branch[1]
      if ('0x' + leafParent.data.slice(0, 2 * 32) !== ST.hash(encoding)) return false // wasn't the right TX!
      for (let j = 1; k < path.length; j++) {
          const bit = path[j]
          const potentialParent = (bit === '0') ? branch[2 * j] : branch[2 * j + 1]
          const actualParent = ST.parent(branch[2 * (j - 1)], branch[2 * (j - 1) + 1])
          if (!areNodesEquivalent(actualParent, potentialParent)) return false
      }
      const potentialRoot = (branch.length > 1) ? ST.parent(branch[branch.length-2], branch[branch.length-1]) : branch[branch.length]
    //TODO check if sum is ffffffff
      if (!areNodesEquivalent(potentialRoot, root)) return false
    }
    return true
  }


  checkSnapshotSubrangeOwner (snapshot, subRange, snapshotHistory) {
    let intersection = {}
    //todo breakout these two lines into a function and reuse in applyTransferToRangeState
    intersection.start = (snapshot.start.lt(subRange.start)) ? subRange.start : snapshot.start // these two lines find the intersection between the deposit and the inquired range
    intersection.end = (snapshot.end.gt(subRange.end)) ? subRange.end : snapshot.end
    //change rangestate to snapshot?  might be confusing
    let rangeState = {range: intersection, owner: deposit.depositer} // initialize rangeState to all owned by depositer
    for (let block = snapshot.block; i < snapshotHistory.toBlock; i++) {
      const blockHistory = snapshotHistory[block] // this is the most internal history element--represents the relevant proofs, for the transactions affecting the deposit range, at this block
      const implicitRange = getImplicitRange(blockHistory) // full coverage of the blockHistory including implicit noTX's
      if (implicitRange.start.gt(intersection.start) || implicitRange.end.lt(intersection.end)) return false // because then the proof doesn't cover ranges even with the implicit noTXs!!! --> in(complete/valid) proof
      for (let proofs in blockHistory) {
        const transfer = proofs.transaction.transfers[proofs.transferIndex]
        rangeState = applyTransferToRangeState(transfer, rangeState)
      }
    }
    if (rangeState.length === 1) return rangeState[0].owner 
    else return false
  }

  // rangeState form: [{start, end, owner}]  <-- adjacent ones only!!! (enforced by client self-benevolence)
  applyTransferToRangeState (transfer, rangeState) {
    //todo add bound cutoffs
    let overwritePoint = _.sortedIndexBy(rangeState, transfer, (range) => range.start.toString(16, 32)) // base 16, length 32  ==> 18 bytes
    if (rangeState[overwritePoint+1].start.eq(transfer.start)) overwritePoint++ // if the two starts were equal, the sort tried to put ours first.  but we really want the thing being overwritten so ++
    const oldRange = rangeState[overwritePoint]
    if (oldRange.owner !== transfer.sender) return false // you didn't own it to send in the first place so gtfo
    if (transfer.end.gt(oldRange.end)) return false // then transfer overlaps an ownership bound and is an invalid history
    rangeState[overwritePoint].owner = transfer.recipient // these three lines replace the oldRange with our new one
    rangeState[overwritePoint].start = transfer.start
    rangeState[overwritePoint].end = transfer.end
    if (transfer.end.eq(oldRange.end)) { // both had same end
      if (transfer.owner === rangeState[overwritePoint + 1].owner) { // then we merge the ranges
        rangeState[overwritePoint].end = rangeState[overwritePoint+1].end
        rangeState.splice(overwritePoint + 1, 1) // remove the range we merged
      }
    } else { // end =/= end --> we gotta add back in the remaining range to the right!
      rangeState.splice(overwritePoint + 1, 0, {start: transfer.end, end: oldRange.end, owner: oldRange.owner}) // add new element after our update for the remaining right side
    }
    if (transfer.start.eq(oldRange.start)) { // both had same start
      if (transfer.owner === rangeState[overwritePoint - 1].owner) { // then we merge the ranges
        rangeState[overwritePoint].start = rangeState[overwritePoint-1].start
        rangeState.splice(overwritePoint, 1) // remove the range we merged
      }
    } else { // start =/= start --> we gotta add back in the remaining range to the left!
      rangeState.splice(overwritePoint, 0, {start: oldRange.start, end: transfer.start, owner: oldRange.owner})
    }
    return rangeState
  }

  //TODO breakout into more reusable function, this is horiblé
  getImplicitRange (transactionProofs) {
    //todo make sure we weren't given something empty(?)
    let leftSum = rightSum = new BN(0)
    const firstProofs = transactionProofs[0]
    const firstBranch = firstProofs.branches[0]
    const firstIndex = new BN(firstProofs.leafIndex).toString(2, firstBranch.length / 2)
    const firstPath = firstIndex.split("").reverse().join("") // reverse the ordering so we start with the bottom
    for (let i = 0; i < firstPath.length; i++) {
      const bit = firstPath[i]
      if (bit === '0') rightSum = rightSum.add(firstBranch[i+1].sum)
    }
    const lastProofs = transactionProofs[transactionProofs.length - 1]
    const lastBranch = lastProofs.branches[lastProofs.branches.length - 1]
    const lastIndex = new BN(lastProofs.leafIndex).toString(2, lastBranch.length / 2)
    const lastPath = lastIndex.split("").reverse().join("") // reverse the ordering so we start with the bottom
    for (let i = 0; i < firstPath.length; i++) {
      const bit = lastPath[i]
      if (bit === '1') leftSum = leftSum.add(lastBranch[i].sum)
    }
    return {start: leftSum, end: new BN('ffffffffffffffffffffffffffffffff',16).sub(rightSum)}
  }

  forBranch(leafIndex, proof, invokeThis) {
    const index = new BN(leafIndex).toString(2, proof.length / 2) // path bitstring
    const path = index.split("").reverse().join("") // reverse the ordering so we start with the bottom
    for (let i = 0; i < path.length; i++) {
      const bit = path[i]
    }
  }

  //TODO: hardcode deposits for testing
  //TODO later: replace hardcoding with ETH service & logic around it
  getMostRecentDeposits(start, end) {
    return [{range, depositer, block}]
  }

//   /**
//    * Checks whether a transaction is valid or not.
//    * @param {*} transaction Transaction to be validated.
//    * @param {*} range Range being transacted.
//    * @param {*} deposits A list of original deposits for that range.
//    * @param {*} history A history of transactions and proofs for that range.
//    * @return {boolean} `true` if the transaction is valid, `false` otherwise.
//    */
//   checkProof (transaction, range, deposits, history) {
//     // TODO: Also check that start and end are within bounds.
//     if (range.end <= range.start) {
//       throw new Error('Invalid range')
//     }
//     // TODO: Check that the history chunks are correctly formed.

//     // Check that the deposits are valid for the given range.
//     // TODO: Throw if false.
//     this._checkDepositsValid(deposits, range)

//     // Determine where to start checking the history.
//     const earliestDeposit = deposits.reduce((prev, curr) => {
//       return prev.block < curr.block ? prev : curr
//     })

//     // Check that the ranges are all covered.
//     // TODO: Throw if false.
//     const requiredRanges = this._getRequiredRanges(deposits)
//     for (let i = earliestDeposit.block; i < transaction.block; i++) {
//       let chunks = history[i]
//       let requiredRange = this._nextLowerValue(requiredRanges, i)
//       this._checkChunksCoverRange(requiredRange, chunks)
//     }

//     // Check that the chunks are all valid.
//     // We do this in a separate loop because it's computationally intensive.
//     // TODO: Throw if false.
//     for (let block in history) {
//       let chunks = history[block]
//       for (let chunk of chunks) {
//         this._checkChunkValid(block, chunk)
//       }
//     }
//   }

//   /**
//    * Checks whether a list of deposits are valid for a range.
//    * @param {*} deposits Deposits to be checked.
//    * @param {*} range Range created by those deposits.
//    * @return {boolean} `true` if the deposits are valid, `false` otherwise.
//    */
//   _checkDepositsValid (deposits, range) {
//     // TODO: Implement this.
//     return true
//   }

//   /**
//    * Checks whether a list of chunks are touching.
//    * Two chunks are touching if the end of the first is
//    * immediately followed by the start of the second.
//    * @param {*} chunks A list of chunks
//    * @return {boolean} `true` if the chunks are touching, `false` otherwise.
//    */
//   _checkChunksTouch (chunks) {
//     return chunks.every((chunk, i) => {
//       return i === 0 || chunk.tx.start === chunks[i - 1].tx.end + 1
//     })
//   }

//   /**
//    * Checks if a set of chunks cover an entire range.
//    * @param {*} range Range to be covered.
//    * @param {*} chunks Chunks to be checked.
//    * @return {boolean} `true` if the chunks cover the range, `false` otherwise.
//    */
//   _checkChunksCoverRange (range, chunks) {
//     const sortedChunks = chunks.sort((a, b) => {
//       return a.tx.start - b.tx.start
//     })

//     const firstChunk = sortedChunks[0]
//     const lastChunk = sortedChunks[sortedChunks.length - 1]
//     return range.start >= firstChunk.tx.start && range.end <= lastChunk.tx.end && this._checkChunksTouch(sortedChunks)
//   }

//   /**
//    * Checks if a chunk is included in the specified block.
//    * @param {*} block Block in which the chunk is included.
//    * @param {*} chunk Chunk to be validated.
//    * @return {boolean} `true` if the chunk is valid, `false` otherwise.
//    */
//   _checkChunkValid (block, chunk) {
//     // TODO: Implement this.
//     return true
//   }

//   /**
//    * Returns the value of the next lower key on an object.
//    * @param {*} obj Object to query.
//    * @param {number} x An integer key.
//    * @return {*} Value of the next key smaller than or equal to `x`.
//    */
//   _nextLowerValue (obj, x) {
//     x = parseInt(x)

//     let lowest = -1
//     for (let key in obj) {
//       key = parseInt(key)
//       if (key > lowest && key <= x) {
//         lowest = key
//       }
//     }

//     return obj[lowest]
//   }

//   /**
//    * Returns an object that describes when parts of a range
//    * were created based on the original deposits.
//    * @param {*} deposits A list of deposits
//    * @return {Object} An object that maps from block numbers to ranges.
//    */
//   _getRequiredRanges (deposits) {
//     const sortedDeposits = deposits.sort((a, b) => {
//       return a.start - b.start
//     })
//     const firstDeposit = sortedDeposits[0]

//     let requiredRanges = {}
//     for (let deposit of deposits) {
//       requiredRanges[deposit.block] = {
//         start: firstDeposit.start,
//         end: deposit.end
//       }
//     }

//     return requiredRanges
//   }
// }

module.exports = ProofSerivce
