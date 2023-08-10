const { subtle } = globalThis.crypto
const EMPTY_ADDRESS = new Uint8Array(16)
const EMPTY_PAYLOAD = new Uint8Array(0)
const HASH_ALGORITHM = "SHA-256"
const SIGNATURE_ALGORITHM = "ECDSA"
const KEY_PARAMETERS = { name: SIGNATURE_ALGORITHM, namedCurve: "P-256" }
const SIGNATURE_PARAMETERS = { name: SIGNATURE_ALGORITHM, hash: HASH_ALGORITHM }

const VERSION = 0x10

const MESSAGE_TYPES = {
    init: VERSION | 0x00,
    challenge: VERSION | 0x01,
    response: VERSION | 0x02,
    accepted: VERSION | 0x03,
    payload: VERSION | 0x04
}

concatUint8Arrays = (payloads) => {
    const payload = new Uint8Array(payloads.reduce((aggregator, runner) => { return aggregator + runner.length }, 0))
    payloads.reduce((aggregator, runner) => {
        payload.set(runner, aggregator)
        return runner.length + aggregator
    }, 0)
    return payload
}

forgeMessage = (type, sender, recipient, payload = EMPTY_PAYLOAD) => {
    return concatUint8Arrays([[type], sender, recipient, payload])
}

forgeInitMessage = (sender) => {
    return forgeMessage(MESSAGE_TYPES.init, sender, EMPTY_ADDRESS)
}

forgeResponseMessage = (sender, challenge, publicKey, nonce, signature) => {
    return forgeMessage(MESSAGE_TYPES.response, sender, EMPTY_ADDRESS, concatUint8Arrays([challenge, publicKey, nonce, signature])) // TODO adaptive difficulty
}

forgePayloadMessage = (sender, recipient, payload) => {
    return forgeMessage(MESSAGE_TYPES.payload, sender, recipient, payload) 
}

parseMessage = (messagePayload, template = {}) => {
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

parseChallengeMessage = (challengeMessage) => {
    const challengeMessageTemplate = {
        difficulty: 16,
        challenge: 16
    }

    return parseMessage(challengeMessage, challengeMessageTemplate)
}

class AcurastClient {

    onPayloadHandlers = []

    async init(){
        this.ecKeyPair = await subtle.generateKey(KEY_PARAMETERS, true, ['sign'])
        this.ws = new WebSocket("ws://localhost:9001/")
        
        this.ws.onopen = async () => {
            const rawPublicKey =  new Uint8Array(await subtle.exportKey("raw", this.ecKeyPair.publicKey))
            const publicKeyHash =  await subtle.digest(HASH_ALGORITHM, rawPublicKey)
            const sender = new Uint8Array(publicKeyHash.slice(0, 16))

            const PROCESSORS = {}
            PROCESSORS[MESSAGE_TYPES.challenge] = async (message) => {
                const challengeMessage = parseChallengeMessage(message)
                const dummyNonce = new Uint8Array(16) // TODO pow
                const tbsPayload = concatUint8Arrays([challengeMessage.challenge, rawPublicKey, dummyNonce])
                const signature = await subtle.sign(SIGNATURE_PARAMETERS, this.ecKeyPair.privateKey, tbsPayload)
                this.ws.send(forgeResponseMessage(sender, challengeMessage.challenge, rawPublicKey, dummyNonce, new Uint8Array(signature)))  
            }

            PROCESSORS[MESSAGE_TYPES.accepted] = (message) => {
                this.sender = sender 
                return sender
            }

            PROCESSORS[MESSAGE_TYPES.payload] = (message) => {
                for(let onPayloadHandler of this.onPayloadHandlers){
                    onPayloadHandler(message)
                }
            }

            this.ws.onmessage = messageEvent => {
                messageEvent.data.arrayBuffer().then(
                    rawMessage => {
                        const message = new Uint8Array(rawMessage)
                        const parsedMessage = parseMessage(message)
                        PROCESSORS[parsedMessage.type](message)
                    }
                )
            }

            this.ws.send(forgeInitMessage(sender))
        }
    }

    async addOnPayloadHandler(onPayloadHandler) {
        this.onPayloadHandlers.push(onPayloadHandler)
    }

    async send(recipient, payload){
        if(this.sender){
            this.ws.send(forgePayloadMessage(this.sender, recipient, payload))
        } else {
            throw new Exception("You don't have a channel setup")
        }
    }
}