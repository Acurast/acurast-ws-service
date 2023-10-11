import { Peer } from './peer'
import { StreamUtils } from '../utils/stream-utils'
import { hexFrom } from '../utils/bytes'

const dynamicLoader = async (): Promise<any> => ({
  createLibp2p: (await import('libp2p')).createLibp2p,
  webSockets: (await import('@libp2p/websockets')).webSockets,
  noise: (await import('@chainsafe/libp2p-noise')).noise,
  yamux: (await import('@chainsafe/libp2p-yamux')).yamux,
  mplex: (await import('@libp2p/mplex')).mplex,
  mdns: (await import('@libp2p/mdns')).mdns
})

export abstract class AbstractPeer implements Peer {
  private node: Promise<any>

  constructor() {
    this.node = this.init()
    this.run()
  }

  private async init(): Promise<any> {
    const { createLibp2p, webSockets, noise, yamux, mplex, mdns } = await dynamicLoader()

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
  private onPeerDiscovery(node: any) {
    node.addEventListener('peer:discovery', (evt: any) => {
      this.onPeerDiscoveryHandler(evt)
    })
  }

  protected abstract onPeerConnectHandler(evt: CustomEvent): void
  private onPeerConnect(node: any) {
    node.addEventListener('peer:connect', async (evt: any) => {
      this.onPeerConnectHandler(evt)
    })
  }

  async broadcast(protocol: string, payload: Uint8Array) {
    const node = await this.node

    node.getPeers().forEach(async (peer: any) => await this.dialProtocol(peer, protocol, payload))
  }

  async dialProtocol(peer: any, protocol: string, payload: Uint8Array) {
    const node = await this.node

    await StreamUtils.write(await node.dialProtocol(peer as any, protocol), hexFrom(payload))
  }

  protected async start() {
    const node = await this.node
    await node.start()
    return node
  }

  async stop() {
    const node = await this.node
    await node.stop()
  }
}
