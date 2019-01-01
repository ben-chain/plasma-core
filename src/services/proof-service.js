const BaseService = require('./base-service')
const BN = require('web3').utils.BN
const _ = require('lodash')
const PlasmaMerkleSumTree = new require('./sum-tree')
const ST = new PlasmaMerkleSumTree()

class ProofSerivce extends BaseService {
  get name () {
    return 'proof-service'
  }

  checkNewTransactionProof (transaction, history) {
    const deposits = getMostRecentDeposits(range)
    return checkHistoryProofFromSnapshot(transaction, history, deposits)
  }

  // history form: history[TRIndex(of Transaction being checked)][relevantSnapshotInd][block][i] = {ith relevant tx, its transferIndex, [its tree indexes], [its [branch]es]}
  // ^ AKA history[TRIndex] = subHistory with subHistory[relevantSnapshotInd][block][i] = as above
  checkHistoryProofFromSnapshot (transaction, history, snapshots) {
    if (!checkValidHistoryFromSnapshots(transaction, history, snapshots)) return false
    //TODO: make sure no trickery with sender or recipient = 0x0000000...
    for (let i = 0; i < transaction.transfers.length; i++) { // for each send in the TX
      const transfer = transaction.transfers[i] // the particular TR
      let trHistory = history[i] // history for this particular TR
      const sender = transfer.sender
      const subRange = {typedStart: transfer.typedStart, typedEnd: transfer.typedEnd}
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
    intersection.typedStart = (snapshot.typedStart.lt(subRange.typedStart)) ? subRange.typedStart : snapshot.typedStart // these two lines find the intersection between the deposit and the inquired range
    intersection.typedEnd = (snapshot.typedEnd.gt(subRange.typedEnd)) ? subRange.typedEnd : snapshot.typedEnd
    //change rangestate to snapshot?  might be confusing
    let rangeState = {range: intersection, owner: deposit.depositer} // initialize rangeState to all owned by depositer
    for (let block = snapshot.block; i < snapshotHistory.toBlock; i++) {
      const blockHistory = snapshotHistory[block] // this is the most internal history element--represents the relevant proofs, for the transactions affecting the deposit range, at this block
      const implicitRange = getImplicitRange(blockHistory) // full coverage of the blockHistory including implicit noTX's
      if (implicitRange.typedStart.gt(intersection.typedStart) || implicitRange.typedEnd.lt(intersection.typedEnd)) return false // because then the proof doesn't cover ranges even with the implicit noTXs!!! --> in(complete/valid) proof
      for (let proofs in blockHistory) {
        const transfer = proofs.transaction.transfers[proofs.transferIndex]
          = applyTransferToRangeState(transfer, rangeState)
      }
    }
    if (rangeState.length === 1) return rangeState[0].owner 
    else return false
  }

  // rangeState form: [{typedStart, end, owner}]  <-- adjacent ones only!!! (enforced by client self-benevolence)
  applyTransferToRangeState (transfer, rangeState) {
    //todo add bound cutoffs
    let overwritePoint = _.sortedIndexBy(rangeState, transfer, (range) => range.start.toString(16, 32)) // base 16, length 32  ==> 18 bytes
    if (rangeState[overwritePoint+1].typedStart.eq(transfer.typedStart)) overwritePoint++ // if the two typedStarts were equal, the sort tried to put ours first.  but we really want the thing being overwritten so ++
    const oldRange = rangeState[overwritePoint]
    if (oldRange.owner !== transfer.sender) return false // you didn't own it to send in the first place so gtfo
    if (transfer.typedEnd.gt(oldRange.typedEnd)) return false // then transfer overlaps an ownership bound and is an invalid history
    rangeState[overwritePoint].owner = transfer.recipient // these three lines replace the oldRange with our new one
    rangeState[overwritePoint].typedStart = transfer.typedStart
    rangeState[overwritePoint].typedEnd = transfer.typedEnd
    if (transfer.typedEnd.eq(oldRange.typedEnd)) { // both had same end
      if (transfer.owner === rangeState[overwritePoint + 1].owner) { // then we merge the ranges
        rangeState[overwritePoint].typedEnd = rangeState[overwritePoint+1].typedEnd
        rangeState.splice(overwritePoint + 1, 1) // remove the range we merged
      }
    } else { // typedEnd =/= typedEnd --> we gotta add back in the remaining range to the right!
      rangeState.splice(overwritePoint + 1, 0, {typedStart: transfer.typedEnd, typedEnd: oldRange.typedEnd, owner: oldRange.owner}) // add new element after our update for the remaining right side
    }
    if (transfer.typedStart.eq(oldRange.typedStart)) { // both had same typedStart
      if (transfer.owner === rangeState[overwritePoint - 1].owner) { // then we merge the ranges
        rangeState[overwritePoint].typedStart = rangeState[overwritePoint-1].typedStart
        rangeState.splice(overwritePoint, 1) // remove the range we merged
      }
    } else { // typedStart =/= typedStart --> we gotta add back in the remaining range to the left!
      rangeState.splice(overwritePoint, 0, {typedStart: oldRange.typedStart, typedEnd: transfer.typedStart, owner: oldRange.owner})
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
    return {typedStart: leftSum, typedEnd: new BN('ffffffffffffffffffffffffffffffff',16).sub(rightSum)}
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
  getMostRecentDeposits(typedStart, typedEnd) {
    return [{range, depositer, block}]
  }
}

module.exports = ProofSerivce
