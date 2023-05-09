# Acurast P2P Websocket Transport Layer

The Acurast P2P Websocket Transport Layer is used to allow direct communication from a dApp to another component (i.e. processor). It's important to say that P2P is interpreted in a logical term as Websockets work with a hub-spoke concept which do not allow for a network layer P2P connection. This is a practical solution that trades off usage in practice, security and decentralisation.

The transport layer is considered "dumb" and the payload is just relayed as-is, it's up to the recipient to give it semantic meaning.

## Websocket Transport Layer Package

The main goal of the package is enable encrypted messages to transferred with as little overhead as possible. Source and destination are expressed with eliptic curve public keys. The initial version of the package will support only the P256 EC. The reason why p256 is chosen is because it's widespread used and supported by hardware security modules, the standard may support other curves in future versions. Unlike TCP we don't have to care about specifying package length, as the websocket protocol itself will handle that. 

.--------+--------------.
| HEADER | PAYLOAD DATA |
'--------+--------------'

### Websocket Transport Layer Header

The Header is a fixed size 65 byte header. The first byte is split into two sections: the first section specifies the version of the protocol this package belongs to (for now only version 1 exits), the second section specifies the type of the package. This byte is followed by 32 bytes for the source public key and then another 32 bytes for the destination public key.

.----------------------------------.
| version                  (4 bit) |
:----------------------------------:
| type                     (4 bit) |
:----------------------------------:
| source public key      (256 bit) |
:----------------------------------:
| destination public key (256 bit) |
:----------------------------------:
|                                  |
| payload                          |
|                                  |
'----------------------------------'

### Message Types

.------.-----------.------------------------------------------------------------------------------------------------.
| type | message   | behaviour                                                                                      |
:------+-----------+--------------------------------------------------------:
| 0000 | syn       | registers the source with the proxy for                |
|      |           | announcing its existense and start receiving messages  |
:------+-----------+--------------------------------------------------------:
| 0001 | ack       | challenges


### Connection Setup

0. Client A decides to connect to the Server B.
1. Client A signalises willingness to setup a registration with a syn package to Server B.
2. Server B acknowledges the registration and sends back a fixed size message, in which the first 16 bytes represent the PoW difficulty and the remaining 16 bytes are used as random nonce (the challenge).
3. Client A crafts a payload containing the nonce and an additional nonce, which when hashed match the difficulty, sign the payload and send it back to Server B.
4. Server B now assigns this websocket to the public key specified in the source field, all messages directed to this public key will be relayed to this websocket.
5. Client A is now allowed to send messages. Spamming will lead to closing of the socket and will trigger a reconnection.