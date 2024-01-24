import { Peer } from './peer'
import { StreamUtils } from '../utils/stream-utils'
import { hexFrom } from '../utils/bytes'
import { proxyConfigReader } from '../proxy-reader'
import { PeerIdBuilder } from './peerid-builder'
import { Observable, Observer } from '../observable/observable'
import { PeerEvent } from './peer-event'
import { PermissionElement } from '../permissions/permission-element'
import { PermissionsUtils } from '../permissions/permissions-utils'
import Permissions from '../permissions/permissions'
import { Logger } from '../utils/Logger'

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
  private readonly allowList: PermissionElement[] =
    PermissionsUtils.initList('permissions.allowList')
  private readonly denyList: PermissionElement[] = PermissionsUtils.initList('permissions.denyList')
  private readonly failedMsgs: Map<string, Uint8Array[]> = new Map()
  private readonly keepAlive: NodeJS.Timeout

  constructor() {
    super()
    this.node = this.init()
    this.keepAlive = this.initKeepAlive()
    this.run()
  }

  private initKeepAlive() {
    return setInterval(() => {
      this.ping()
    }, 60000)
  }

  private addFailedMsg(key: string, payload: Uint8Array) {
    if (this.failedMsgs.has(key)) {
      this.failedMsgs.get(key)?.push(payload)
    } else {
      this.failedMsgs.set(key, [payload])
    }
  }

  protected getFailedMsgs(key: string): Uint8Array[] {
    const msgs = this.failedMsgs.get(key) ?? []
    this.failedMsgs.delete(key)
    return msgs
  }

  protected override unsubscribe(observer: Observer<PeerEvent<Uint8Array>>): void {
    clearInterval(this.keepAlive)
    super.unsubscribe(observer)
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
        Logger.log(evt.detail.toString(), 'unauthorized.')
        this.hangUp(evt.detail)
      } else {
        this.onPeerConnectHandler(evt)
      }
    })
  }

  async broadcast(protocol: string, payload: Uint8Array) {
    Logger.debug('AbstractPeer', 'broadcast', 'begin')
    const node = await this.node

    await Promise.allSettled(
      node.getPeers().map((peer: any) => this.dialProtocol(peer, protocol, payload))
    )

    Logger.debug('AbstractPeer', 'broadcast', 'end')
  }

  protected async ping() {
    Logger.debug('AbstractPeer', 'ping', 'begin')
    const node = await this.node

    await Promise.allSettled(node.getPeers().map((peer: any) => node.dial(peer)))

    Logger.debug('AbstractPeer', 'ping', 'end')
  }

  protected async dialProtocol(peer: any, protocol: string, payload: Uint8Array) {
    Logger.debug('AbstractPeer', 'dialProtocol', 'begin')
    const node = await this.node
    try {
      await StreamUtils.write(await node.dialProtocol(peer, protocol), hexFrom(payload))
    } catch (err: any) {
      Logger.error(err.message)
      this.addFailedMsg(peer.toString(), payload)
    }
    Logger.debug('AbstractPeer', 'dialProtocol', 'end')
  }

  protected async hangUp(peer: any) {
    const node = await this.node
    node.hangUp(peer)
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
