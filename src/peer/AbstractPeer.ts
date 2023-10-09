import { Libp2p, createLibp2p } from 'libp2p'
import { PeerId } from '@libp2p/interface-peer-id'
import { Node } from './Peer.js'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { mdns } from '@libp2p/mdns'
import { StreamUtils } from '../utils/stream-utils.js'

export abstract class AbstractPeer implements Node {
  private node: Promise<Libp2p>

  constructor() {
    this.node = this.init()
    this.run()
  }

  private async init(): Promise<Libp2p> {
    const node = await createLibp2p({
      start: false,
      transports: [webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux(), mplex()],
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0/ws'] // tcp/0 means "assign a random port"
      },
      peerDiscovery: [
        mdns({
          interval: 20e3
        }) as any
      ]
    })

    this.onPeerDiscovery(node)
    this.onPeerConnect(node)

    return node
  }

  protected abstract run(): Promise<void>

  protected abstract onPeerDiscoveryHandler(evt: CustomEvent): void
  private onPeerDiscovery(node: Libp2p) {
    node.addEventListener('peer:discovery', (evt) => {
      this.onPeerDiscoveryHandler(evt)
    })
  }

  protected abstract onPeerConnectHandler(evt: CustomEvent): void
  private onPeerConnect(node: Libp2p): void {
    node.addEventListener('peer:connect', async (evt) => {
      this.onPeerConnectHandler(evt)
    })
  }

  async broadcast(protocol: string, payload: Uint8Array) {
    const node = await this.node

    node
      .getPeers()
      .forEach(async (peer) =>
        StreamUtils.write(
          await node.dialProtocol(peer, protocol),
          StreamUtils.fromUint8ArraytoString(payload)
        )
      )
  }

  async dialProtocol(peer: PeerId, protocol: string, payload: any) {
    const node = await this.node

    StreamUtils.write(await node.dialProtocol(peer as any, protocol), JSON.stringify(payload))
  }

  protected async start(): Promise<Libp2p> {
    const node = await this.node
    await node.start()
    return node
  }

  async stop(): Promise<void> {
    const node = await this.node
    await node.stop()
  }
}
