const { EMPTY_ADDRESS, DIFFICULTY, EMPTY_PAYLOAD, concatUint8Arrays, toHexString, arrayEquals, arrayGreaterThan } = require("./utils");
const { subtle } = globalThis.crypto
const HASH_ALGORITHM = "SHA-256"
const SIGNATURE_ALGORITHM = "ECDSA"
const KEY_PARAMETERS = { name: SIGNATURE_ALGORITHM, namedCurve: "P-256" }
const SIGNATURE_PARAMETERS = { name: SIGNATURE_ALGORITHM, hash: HASH_ALGORITHM }

exports.parseMessage = (messagePayload, template = {}) => {
    const rawMessage = {
        type: messagePayload[0],
        sender: messagePayload.slice(1, 17),
        recipient: messagePayload.slice(17, 33),
        payload: messagePayload.slice(33, messagePayload.length)
    }
    let runner = 0
    for (let key in template) {
        const fieldLength = template[key]
        rawMessage[key] = rawMessage.payload.slice(runner, runner+fieldLength)
        runner += fieldLength
    }
    return rawMessage
}

exports.forgeMessage = (type, sender, recipient, payload=EMPTY_PAYLOAD) => {
    return concatUint8Arrays([[type], sender, recipient, payload])
}

exports.VERSION = 0x10

exports.MESSAGE_TYPES = {
    init: exports.VERSION | 0x00,
    challenge: exports.VERSION | 0x01,
    response: exports.VERSION | 0x02,
    accepted: exports.VERSION | 0x03,
    payload: exports.VERSION | 0x04
}

exports.forgeInitMessage = (sender) => {
    return exports.forgeMessage(exports.MESSAGE_TYPES.init, sender, EMPTY_ADDRESS)
}

exports.forgeChallengeMessage = (recipient, challenge, difficulty = DIFFICULTY) => {
    return this.forgeMessage(exports.MESSAGE_TYPES.challenge, EMPTY_ADDRESS, recipient, concatUint8Arrays([difficulty, challenge])) // TODO adaptive difficulty
}

exports.forgeResponseMessage = (sender, challenge, publicKey, nonce, signature) => {
    return this.forgeMessage(exports.MESSAGE_TYPES.response, sender, EMPTY_ADDRESS, concatUint8Arrays([challenge, publicKey, nonce, signature])) // TODO adaptive difficulty
}

exports.forgeAcceptMessage = (recipient) => {
    return this.forgeMessage(exports.MESSAGE_TYPES.accepted, EMPTY_ADDRESS, recipient) 
}

exports.forgePayloadMessage = (sender, recipient, payload) => {
    return this.forgeMessage(exports.MESSAGE_TYPES.payload, sender, recipient, payload) 
}

exports.parseChallengeMessage = (challengeMessage) => {
    const challengeMessageTemplate = {
        difficulty: 16,
        challenge: 16
    }

    return exports.parseMessage(challengeMessage, challengeMessageTemplate)
}

exports.parseResponseMessage = (responseMessage) => {
    const responseMessageTemplate = {
        challenge: 16,
        publicKey: 65,
        nonce: 16,
        signature: 64
    }

    return exports.parseMessage(responseMessage, responseMessageTemplate)
}

exports.validateResponseMessage = async (responseMessage, challenge, difficulty = DIFFICULTY) => {
    if (!arrayEquals(responseMessage.challenge, challenge)) {
        console.log("unequal challenge")
        return false
    } else {
        const publicKeyHash = new Uint8Array(await subtle.digest(HASH_ALGORITHM, responseMessage.publicKey))
        if (!arrayEquals(responseMessage.sender, publicKeyHash.slice(0, 16))) {
            console.log("sender and pubkeyhash no match")
            return false
        } else {
            const responseTBSPayload = concatUint8Arrays(responseMessage.challenge, responseMessage.publicKey, responseMessage.nonce)
            const difficultyHash = await subtle.digest(HASH_ALGORITHM, responseTBSPayload)
            if (!arrayGreaterThan(difficulty, difficultyHash)) {
                console.log("difficulty too low")
                return false
            } else {
                const key = await subtle.importKey("raw", responseMessage.publicKey, KEY_PARAMETERS, false, ['verify'])
                const verified = await subtle.verify(
                    SIGNATURE_PARAMETERS,
                    key,
                    responseMessage.signature,
                    responseTBSPayload)
                return verified
            }
        }
    }
}