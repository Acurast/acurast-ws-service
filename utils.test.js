const messages = require('./messages.js')
const utils = require('./utils.js')
const subtle = globalThis.crypto
test('concat test', () => {
    const nonce = new Uint8Array(16)
    crypto.getRandomValues(nonce)
    const concattedArray = utils.concatUint8Arrays([utils.EMPTY_ADDRESS, nonce, utils.EMPTY_ADDRESS])
    expect(utils.toHexString(concattedArray)).toBe(utils.toHexString(utils.EMPTY_ADDRESS)+utils.toHexString(nonce)+utils.toHexString(utils.EMPTY_ADDRESS))
})

xtest('pow test', async () => {
    const nonce = new Uint8Array(16)
    crypto.getRandomValues(nonce)

    const pow = await utils.proofOfWork(nonce)
    const isValidPow = await utils.validateProofOfWork(nonce, pow)
    
    expect(true).toBe(isValidPow)
})