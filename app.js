const LISTENERS = {}

const LISTENERS_REVERSE_LOOKUP = {}

const PROCESSORS = {}

const messages = require('./messages.js')
const { toHexString } = require('./utils.js')

PROCESSORS[messages.MESSAGE_TYPES.init] = (ws, message) => {
    const parsedMessage = messages.parseMessage(message)
    const challenge = new Uint8Array(16)
    crypto.getRandomValues(challenge)
    
    LISTENERS_REVERSE_LOOKUP[ws] = { challenge:challenge, address:parsedMessage.sender } 

    ws.send(messages.forgeChallengeMessage(parsedMessage.sender, challenge), true)
}

PROCESSORS[messages.MESSAGE_TYPES.response] = async (ws, message) => {
    const responseMessage = messages.parseResponseMessage(message)
    const isResponseValid = await messages.validateResponseMessage(responseMessage, LISTENERS_REVERSE_LOOKUP[ws].challenge)
    console.log("validating response")
    if(isResponseValid){    
        console.log("response good")
        LISTENERS[responseMessage.sender] = ws
        ws.send(messages.forgeAcceptMessage(responseMessage.sender), true)
    }   
}

PROCESSORS[messages.MESSAGE_TYPES.payload] = (ws, message) => {
    const parsedMessage = messages.parseMessage(message)
    if(parsedMessage.sender in LISTENERS && parsedMessage.recipient in LISTENERS){
        LISTENERS[parsedMessage.recipient].send(message, true)
    }   
}

require('uWebSockets.js').App().ws('/*', {
    // /* There are many common helper features */
    idleTimeout: 10,
    maxBackpressure: 1024,
    // maxPayloadLength: 512,
    // compression: DEDICATED_COMPRESSOR_3KB,

    /* For brevity we skip the other events (upgrade, open, ping, pong, close) */
    message: (ws, message, isBinary) => {
        message = new Uint8Array(message)
        const parsedMessage = messages.parseMessage(message)
        PROCESSORS[parsedMessage.type](ws, message)
    },
    close: (ws) => {
        console.log("cleanup")

        if (ws in LISTENERS_REVERSE_LOOKUP){
            if(LISTENERS_REVERSE_LOOKUP[ws].address in LISTENERS){
                delete LISTENERS[LISTENERS_REVERSE_LOOKUP[ws].address]
            }
            delete LISTENERS_REVERSE_LOOKUP[ws]
        }
        console.log(LISTENERS_REVERSE_LOOKUP)
        console.log(LISTENERS)
    }
}).get('/*', (res, req) => {

    /* It does Http as well */
    res.writeStatus('200 OK').writeHeader('access-control-allow-origin', '*').end('Hello there!');

}).listen(9001, (listenSocket) => {
    if (listenSocket) {
        console.log('Listening to port 9001');
    }
});