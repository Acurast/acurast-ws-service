import { AbstractPeer } from './abstract-peer'
import { StreamUtils } from '../utils/stream-utils'
import { hexTo } from '../utils/bytes'
import { PeerHandlers } from './peer-handlers'
import { PeerEventType } from './peer-event'
import { Logger } from '../utils/Logger'

export class Listener extends AbstractPeer {
  constructor() {
    super()
  }

  protected override onPeerDiscoveryHandler(evt: CustomEvent<any>): void {
    Logger.log('Peer discovered: ', evt.detail.id.toString())
  }
  protected override onPeerConnectHandler(evt: CustomEvent<any>): void {
    Logger.log('Peer connected: ', evt.detail.toString())
  }

  private async onMessageForwarded(message: string) {
    this.next({ type: PeerEventType.MESSAGE_RECEIVED, message: hexTo(message) })
  }

  private async onNotifyDelivery(message: string) {
    this.next({ type: PeerEventType.MESSAGE_CLEANUP, message: hexTo(message) })
  }

  protected override async run(): Promise<void> {
    const node = await this.start()

    await node.handle(PeerHandlers.FOWARD_MESSAGE, async ({ connection, stream }: any) => {
      Logger.debug('Listener', PeerHandlers.FOWARD_MESSAGE, 'begin')
      Logger.log(`${node.peerId}/client-discovery: request received from ${connection.remotePeer}`)
      await StreamUtils.read(stream, this.onMessageForwarded.bind(this))
      Logger.debug('Listener', PeerHandlers.FOWARD_MESSAGE, 'end')
    })

    await node.handle(PeerHandlers.MESSAGE_CLEANUP, async ({ connection, stream }: any) => {
      Logger.debug('Listener', PeerHandlers.MESSAGE_CLEANUP, 'begin')
      Logger.log(`${node.peerId}/message-cleanup: request received from ${connection.remotePeer}`)
      await StreamUtils.read(stream, this.onNotifyDelivery.bind(this))
      Logger.debug('Listener', PeerHandlers.MESSAGE_CLEANUP, 'end')
    })

    Logger.log('Listener ready, listening on:')
    node.getMultiaddrs().forEach((addr: any) => Logger.log(addr.toString()))
  }
}
