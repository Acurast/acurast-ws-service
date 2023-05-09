require('uWebSockets.js').App().ws('/*', {
    // /* There are many common helper features */
    // idleTimeout: 32,
    // maxBackpressure: 1024,
    // maxPayloadLength: 512,
    // compression: DEDICATED_COMPRESSOR_3KB,

    /* For brevity we skip the other events (upgrade, open, ping, pong, close) */
    message: (ws, message, isBinary) => {
        
        /* Here we echo the message back, using compression if available */
        let ok = ws.send(message, isBinary, true);
        
        console.log(message)

        console.log(String.fromCharCode.apply(null, new Uint8Array(ws.getUserData())))
    }
}).get('/*', (res, req) => {

    /* It does Http as well */
    res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
    
  }).listen(9001, (listenSocket) => {
    if (listenSocket) {
        console.log('Listening to port 9001');
    }
});