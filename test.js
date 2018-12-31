/*
const PlasmaApp = require('./src/plasma-app')

const plasma = new PlasmaApp({
  dbBackend: 'ephem',
  rpcPort: '9898',
  contract: {
    abi: '',
    address: '0x0'
  }
})

const deposits = [
  {
    block: 0,
    start: 0,
    end: 50
  }
]

const history = {
  0: [
    {
      tx: {
        start: 0,
        end: 1
      },
      proof: ''
    },
    {
      tx: {
        start: 2,
        end: 50
      },
      proof: ''
    }
  ]
}

const range = {
  start: 0,
  end: 51
}

const transaction = {
  block: 1
}
*/

const PlasmaApp = require('./src/plasma-app')

const plasma = new PlasmaApp({
  dbBackend: 'ephem',
  rpcPort: '9898',
  contract: {
    abi: '',
    address: '0x0'
  }
})

const sender = '0x000000000000'
const recipient = '0x999999999999'
const transaction1 = {
  block: 1,
  from: sender,
  to: recipient,
  range: {
    token: 'OMG',
    start: 0,
    end: 50
  }
}

const transaction2 ={
  block: 2,
  from: recipient,
  to: sender,
  range: {
    token: 'OMG',
    start: 0,
    end: 0
  }
}

const test = async () => {
  try {
    await plasma.services.chain.addTransaction(transaction1)
    const balances = await plasma.services.chain.getBalances(recipient)
    console.log(balances)
    const ranges = await plasma.services.chain.getOwnedRanges(recipient)
    console.log(ranges)
    const receipt = await plasma.services.chain.sendTransaction(transaction2)
    console.log(receipt)
  } catch (err) {
    console.log(err)
  }
}

test()
