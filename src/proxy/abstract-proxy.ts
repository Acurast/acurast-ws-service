import { ConnectionData } from '../connection-data/connection-data'
import { Listener } from '../peer/listener'
import { MessageProcessor } from '../processor/message-processor'
import { V1MessageProcessor } from '../processor/v1-message-processor'
import type WebSocket from 'ws'
import { Logger } from '../utils/Logger'
import { Subscription } from 'src/observable/observable'
import { PeerEvent } from '../peer/peer-event'
import { MessageScheduler } from '../scheduler/message-scheduler'
import { proxyConfigReader } from '../proxy-reader'

export abstract class AbstractProxy {
  private subscriptions: Subscription[] = []
  private timeout: number = proxyConfigReader('scheduler.timeframe', 30000)
  protected readonly processors: Record<number, MessageProcessor> = {
    1: new V1MessageProcessor()
  }
  protected readonly webSockets: Map<string, WebSocket> = new Map()
  protected readonly webSocketsReversed: Map<WebSocket, string> = new Map()
  protected readonly webSocketsData: Map<string, ConnectionData> = new Map()
  protected readonly listener: Listener = new Listener()
  protected readonly webSocketsTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.init()
  }

  private init() {
    this.subscriptions.push(this.listener.subscribe((data) => this.onNetworkMessage(data)))
  }

  protected abstract onNetworkMessage(message: PeerEvent<Uint8Array>): void

  cleanup() {
    MessageScheduler.instance.cleanup()
  }

  destroy() {
    Logger.debug('AbstractProxy', 'destroy', 'begin')
    this.listener.stop()
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    Logger.debug('AbstractProxy', 'destroy', 'begin')
  }

  protected prepareConnectionCleanup(sender: string) {
    // cleanup if client doesn't reconnect in time
    this.webSocketsTimeouts.set(
      sender,
      setTimeout(() => {
        MessageScheduler.instance.getAll(sender)
      }, this.timeout)
    )
  }

  protected removeConnectionCleanup(sender: string) {
    // reset cleanup if client recconects in time
    clearTimeout(this.webSocketsTimeouts.get(sender))
    this.webSocketsTimeouts.delete(sender)
  }
}
