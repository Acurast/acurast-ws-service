import { AbstractPeer } from './abstract-peer'
import { StreamUtils } from '../utils/stream-utils'
import { hexTo } from '../utils/bytes'
import { PeerHandlers } from './peer-handlers'
import { PeerEventType } from './peer-event'
import { Logger } from '../utils/Logger'
import * as Sentry from '@sentry/node'

export class Listener extends AbstractPeer {
  constructor() {
    super()
  }

  protected override onPeerDiscoveryHandler(evt: CustomEvent<any>): void {
    Logger.log('Peer discovered: ', evt.detail.id.toString())
  }
  protected override onPeerConnectHandler(evt: CustomEvent<any>): void {
    const peerId = evt.detail.toString()
    Logger.log('Peer connected: ', peerId)

    // in the event a node has abruptly disconnected, send again all undelivered messages
    const failedMsgs = this.getFailedMsgs(peerId)

    if (!failedMsgs.length) {
      return
    }

    Logger.log(`Forwarding lost messages to ${peerId}`)
    Promise.allSettled(
      failedMsgs.map((msg) => this.dialProtocol(evt.detail, PeerHandlers.FOWARD_MESSAGE, msg))
    )
  }

  private onMessageForwarded(message: string) {
    this.next({ type: PeerEventType.MESSAGE_RECEIVED, message: hexTo(message) })
  }

  private onNotifyDelivery(message: string) {
    this.next({ type: PeerEventType.MESSAGE_CLEANUP, message: hexTo(message) })
  }

  protected override async run(): Promise<void> {
    const node = await this.start()

    node.handle(PeerHandlers.FOWARD_MESSAGE, async ({ connection, stream }: any) => {
      Logger.debug('Listener', PeerHandlers.FOWARD_MESSAGE, 'begin')
      Logger.log(`${node.peerId}/client-discovery: request received from ${connection.remotePeer}`)

      StreamUtils.read(stream, this.onMessageForwarded.bind(this)).catch((err) => {
        Logger.error(err.message)
        Sentry.captureException(err)
      })

      Logger.debug('Listener', PeerHandlers.FOWARD_MESSAGE, 'end')
    })

    node.handle(PeerHandlers.MESSAGE_CLEANUP, async ({ connection, stream }: any) => {
      Logger.debug('Listener', PeerHandlers.MESSAGE_CLEANUP, 'begin')
      Logger.log(`${node.peerId}/message-cleanup: request received from ${connection.remotePeer}`)

      StreamUtils.read(stream, this.onNotifyDelivery.bind(this)).catch((err) => {
        Logger.error(err.message)
        Sentry.captureException(err)
      })

      Logger.debug('Listener', PeerHandlers.MESSAGE_CLEANUP, 'end')
    })

    Logger.log('Listener ready, listening on:')
    node.getMultiaddrs().forEach((addr: any) => Logger.log(addr.toString()))
  }
}
