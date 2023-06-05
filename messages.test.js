const messages = require('./messages.js')
const utils = require('./utils.js')

test('forge and parse yields same results', () => {
    const emptyMessagePayload = messages.forgeMessage(messages.MESSAGE_TYPES.init, utils.EMPTY_ADDRESS, utils.EMPTY_ADDRESS, [])
    expect(emptyMessagePayload.length).toBe(33)
    const message = messages.parseMessage(emptyMessagePayload)
    expect(utils.toHexString(message.sender)).toBe("00000000000000000000000000000000")
    expect(utils.toHexString(message.recipient)).toBe("00000000000000000000000000000000")
    expect(message.type).toBe(messages.MESSAGE_TYPES.init)

    const sender = new Uint8Array(16)
    crypto.getRandomValues(sender)

    const recipient = new Uint8Array(16)
    crypto.getRandomValues(recipient)

    const randomMessagePayload = messages.forgeMessage(messages.MESSAGE_TYPES.init, sender, recipient, [])
    expect(randomMessagePayload.length).toBe(33)

    const randomMessage = messages.parseMessage(randomMessagePayload)
    expect(utils.toHexString(randomMessage.sender)).toBe(utils.toHexString(sender))
    expect(utils.toHexString(randomMessage.recipient)).toBe(utils.toHexString(recipient))
    expect(randomMessage.type).toBe(messages.MESSAGE_TYPES.init)
})