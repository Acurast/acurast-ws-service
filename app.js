const LISTENERS = {}

const LISTENERS_REVERSE_LOOKUP = {}

const PROCESSORS = {
}

const messages = require('./messages.js')

PROCESSORS[messages.MESSAGE_TYPES.init] = (ws, message) => {
    const parsedMessage = messages.parseMessage(message)
    const nonce = new Uint8Array(16)
    crypto.getRandomValues(nonce)

    const challenge = new Uint8Array([messages.MESSAGE_TYPES.challenge])
    
    LISTENERS_REVERSE_LOOKUP[ws] = { challenge:challenge, address:parsedMessage.sender } 

    ws.send(messages.messages.forgeChallengeMessage(parsedMessage.sender, challenge), true)
}

PROCESSORS[messages.MESSAGE_TYPES.response] = async (ws, message) => {
    const responseMessage = messages.parseResponseMessage(message)
    const isResponseValid = await messages.validateResponseMessage(responseMessage, LISTENERS_REVERSE_LOOKUP[ws].challenge)

    if(isResponseValid){    
        LISTENERS[responseMessagen.sender] = ws
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
    idleTimeout: 32,
    maxBackpressure: 1024,
    // maxPayloadLength: 512,
    // compression: DEDICATED_COMPRESSOR_3KB,

    /* For brevity we skip the other events (upgrade, open, ping, pong, close) */
    message: (ws, message, isBinary) => {
        const parsedMessage = messages.parseMessage(message)
        PROCESSORS[parsedMessage.type](ws, message)
        console.log(message)
    },
    close: (ws) => {
        delete LISTENERS[LISTENERS_REVERSE_LOOKUP[ws].address]
        delete LISTENERS_REVERSE_LOOKUP[ws]
    }
}).get('/*', (res, req) => {

    /* It does Http as well */
    res.writeStatus('200 OK').writeHeader('access-control-allow-origin', '*').end('Hello there!');

}).listen(9001, (listenSocket) => {
    if (listenSocket) {
        console.log('Listening to port 9001');
    }
});