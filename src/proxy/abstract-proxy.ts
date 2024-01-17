import { ConnectionData } from '../conection-data/connection-data'
import { Listener } from '../peer/listener'
import { Subscription } from '../observable/observable'
import { MessageProcessor } from '../processor/message-processor'
import { V1MessageProcessor } from '../processor/v1-message-processor'
import type WebSocket from 'ws'
import { PeerEvent, PeerEventType } from '../peer/peer-event'
import { Logger } from '../utils/Logger'

export abstract class AbstractProxy {
  private subscriptions: Subscription[] = []
  protected readonly processors: Record<number, MessageProcessor> = {
    1: new V1MessageProcessor()
  }
  protected readonly webSockets: Map<string, WebSocket> = new Map()
  protected readonly webSocketsReversed: Map<WebSocket, string> = new Map()
  protected readonly webSocketsData: Map<string, ConnectionData> = new Map()
  protected readonly listener: Listener = new Listener()

  protected init() {
    this.subscriptions.push(this.listener.subscribe((data) => this.onNetworkMessage(data)))
  }

  constructor() {
    this.init()
  }

  protected abstract handleMessage(message: Uint8Array): void
  protected abstract cleanupMessages(sender: Uint8Array): void

  private onNetworkMessage(data: PeerEvent<Uint8Array>): void {
    Logger.debug('AbstractProxy', 'onNetworkMessage', 'begin')
    switch (data.type) {
      case PeerEventType.MESSAGE_RECEIVED:
        this.handleMessage(data.message)
        break
      case PeerEventType.MESSAGE_CLEANUP:
        this.cleanupMessages(data.message)
        break
      default:
        break
    }
    Logger.debug('AbstractProxy', 'onNetworkMessage', 'end')
  }

  destroy() {
    Logger.debug('AbstractProxy', 'destroy', 'begin')
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    this.listener.stop()
    Logger.debug('AbstractProxy', 'destroy', 'begin')
  }
}
