import { Peer } from './peer'
import { proxyConfigReader } from '../proxy-reader'
import { PeerIdBuilder } from './peerid-builder'
import { PermissionElement } from '../permissions/permission-element'
import { PermissionsUtils } from '../permissions/permissions-utils'
import Permissions from '../permissions/permissions'
import { Logger } from '../utils/Logger'
import { Observable } from '../observable/observable'
import { PeerEvent } from './peer-event'
import { TopicsFilter } from './topics-filter'

const dynamicLoader = async (): Promise<any> => ({
  createLibp2p: (await import('libp2p')).createLibp2p,
  webSockets: (await import('@libp2p/websockets')).webSockets,
  noise: (await import('@chainsafe/libp2p-noise')).noise,
  yamux: (await import('@chainsafe/libp2p-yamux')).yamux,
  mplex: (await import('@libp2p/mplex')).mplex,
  mdns: (await import('@libp2p/mdns')).mdns,
  bootstrap: (await import('@libp2p/bootstrap')).bootstrap,
  gossipsub: (await import('@chainsafe/libp2p-gossipsub')).gossipsub,
  identify: (await import('@libp2p/identify')).identify,
  dcutr: (await import('@libp2p/dcutr')).dcutr
})

export abstract class AbstractPeer extends Observable<PeerEvent<Uint8Array>> implements Peer {
  private node: any
  private readonly allowList: PermissionElement[] =
    PermissionsUtils.initList('permissions.allowList')
  private readonly denyList: PermissionElement[] = PermissionsUtils.initList('permissions.denyList')

  constructor() {
    super()
    this.init()
    this.initKeepAlive()
  }

  private initKeepAlive() {
    return setInterval(() => {
      this.ping()
    }, 60000)
  }

  private async init() {
    const {
      createLibp2p,
      webSockets,
      noise,
      yamux,
      mplex,
      bootstrap,
      mdns,
      gossipsub,
      identify,
      dcutr
    } = await dynamicLoader()

    const peerId = await PeerIdBuilder.build()
    const port = proxyConfigReader<number>('port', 0)
    const bootstrappers = proxyConfigReader('bootstrap.peers', [])
    const discoveryMechanism = bootstrappers.length
      ? bootstrap({ list: bootstrappers })
      : mdns({
          interval: 3000
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
      peerDiscovery: [
        discoveryMechanism
      ],
      services: {
        identify: identify(),
        pubsub: gossipsub({
          // allowPublishToZeroTopicPeers: true,
          emitSelf: true,
          doPX: true
        }),
        dcutr: dcutr()
      }
    })

    node.services.pubsub.addEventListener(
      'message',
      ({ detail: { topic: id, data: message } }: any) => {
        TopicsFilter.allow(id) && this.next({ id, message })
      }
    )

    this.onPeerDiscovery(node)
    this.onPeerConnect(node)

    this.node = node
    this.run()
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
    node.addEventListener('peer:connect', (evt: any) => {
      if (!Permissions.isAllowed(evt.detail.toString(), this.allowList, this.denyList)) {
        Logger.log(evt.detail.toString(), 'unauthorized.')
        this.hangUp(evt.detail)
      } else {
        this.onPeerConnectHandler(evt)
      }
    })
  }

  send(recipient: string, message: Uint8Array) {
    return this.node.services.pubsub.publish(recipient, message)
  }

  listen(sender: string) {
    return this.node.services.pubsub.subscribe(sender)
  }

  removeListener(sender: string) {
    return this.node.services.pubsub.unsubscribe(sender)
  }

  protected ping() {
    Logger.debug('AbstractPeer', 'ping', 'begin')
    Promise.all(this.node.getPeers().map((peer: any) => this.node.dial(peer)))
    Logger.debug('AbstractPeer', 'ping', 'end')
  }

  protected hangUp(peer: any) {
    this.node.hangUp(peer)
  }

  protected async start() {
    await this.node.start()
    return this.node
  }

  async stop() {
    await this.node.stop()
  }
}
