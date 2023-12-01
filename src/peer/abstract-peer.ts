import { Peer } from './peer'
import { StreamUtils } from '../utils/stream-utils'
import { hexFrom } from '../utils/bytes'
import { proxyConfigReader } from '../proxy-reader'
import { PeerIdBuilder } from './peerid-builder'
import { Observable } from '../observable/observable'
import { PeerEvent } from './peer-event'
import { PermissionElement } from '../permissions/permission-element'
import { PermissionsUtils } from '../permissions/permissions-utils'
import Permissions from '../permissions/permissions'

const dynamicLoader = async (): Promise<any> => ({
  createLibp2p: (await import('libp2p')).createLibp2p,
  webSockets: (await import('@libp2p/websockets')).webSockets,
  noise: (await import('@chainsafe/libp2p-noise')).noise,
  yamux: (await import('@chainsafe/libp2p-yamux')).yamux,
  mplex: (await import('@libp2p/mplex')).mplex,
  mdns: (await import('@libp2p/mdns')).mdns,
  bootstrap: (await import('@libp2p/bootstrap')).bootstrap
})

export abstract class AbstractPeer extends Observable<PeerEvent<Uint8Array>> implements Peer {
  private node: Promise<any>
  private readonly allowList: PermissionElement[] = PermissionsUtils.initList('permissions.allowList')
  private readonly denyList: PermissionElement[] = PermissionsUtils.initList('permissions.denyList')

  constructor() {
    super()
    this.node = this.init()
    this.run()
  }

  private async init(): Promise<any> {
    const { createLibp2p, webSockets, noise, yamux, mplex, bootstrap, mdns } = await dynamicLoader()

    const peerId = await PeerIdBuilder.build()
    const port = proxyConfigReader<number>('port', 0)
    const bootstrappers = proxyConfigReader('bootstrap.peers', [])
    const discoveryMechanism = bootstrappers.length
      ? bootstrap({ list: bootstrappers })
      : mdns({
          interval: 20e3
        })

    const node = await createLibp2p({
      peerId,
      start: false,
      transports: [webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux(), mplex()],
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${port}/ws`] // tcp/0 = "assign a random port"
      },
      peerDiscovery: [discoveryMechanism]
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
      if (!Permissions.isAllowed(evt.detail.toString(), this.allowList, this.denyList)) {
        console.log(evt.detail.toString(), 'unauthorized.')
        node.hangUp(evt.detail)
      } else {
        this.onPeerConnectHandler(evt)
      }
    })
  }

  async broadcast(protocol: string, payload: Uint8Array) {
    const node = await this.node

    await Promise.allSettled(
      node.getPeers().map((peer: any) => this.dialProtocol(peer, protocol, payload))
    )
  }

  protected async ping(peer: any) {
    const node = await this.node
    await node.dial(peer)
  }

  protected async dialProtocol(peer: any, protocol: string, payload: Uint8Array) {
    const node = await this.node
    await StreamUtils.write(await node.dialProtocol(peer, protocol), hexFrom(payload))
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
