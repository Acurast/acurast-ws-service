import { ConnectionData } from '../connection-data/connection-data'
import {
  MessageProcessor,
} from '../processor/message-processor'
import { V1MessageProcessor } from '../processor/v1-message-processor'
import type WebSocket from 'ws'
import { Logger } from '../utils/Logger'
import { PeerEvent } from '../peer/peer-event'
import { MessageScheduler } from '../scheduler/message-scheduler'
import { proxyConfigReader } from '../proxy-reader'
import { ProcessorWorkerResponse, WorkerError, WorkerType } from '../worker/worker-types'
import { WorkerPool } from '../worker/worker-pool'

export abstract class AbstractProxy {
  private timeout: number = proxyConfigReader('scheduler.interval', 30000)
  protected readonly processors: Record<number, MessageProcessor> = {
    1: new V1MessageProcessor()
  }
  protected readonly webSockets: Map<string, WebSocket> = new Map()
  protected readonly webSocketsReversed: Map<WebSocket, string> = new Map()
  protected readonly webSocketsData: Map<string, ConnectionData> = new Map()
  protected readonly webSocketsTimeouts: Map<string, NodeJS.Timeout> = new Map()
  protected readonly pendingConnections: Map<string, WebSocket> = new Map()

  protected readonly pool: WorkerPool = new WorkerPool(
    new Map([
      [
        WorkerType.PROCESSOR,
        {
          amount: 1,
          handler: this.processorWorkerHandler.bind(this)
        }
      ],
      [
        WorkerType.LISTENER,
        {
          amount: 1,
          handler: this.listenerWorkerHandler.bind(this)
        }
      ]
    ])
  )

  protected abstract processorWorkerHandler(data: ProcessorWorkerResponse | WorkerError): void; 
  protected abstract listenerWorkerHandler(data: PeerEvent<Uint8Array> | WorkerError): void; 
  protected abstract onNetworkMessage(message: PeerEvent<Uint8Array>): void

  cleanup() {
    MessageScheduler.instance.cleanup()
  }

  destroy() {
    Logger.debug('AbstractProxy', 'destroy', 'begin')
    this.pool.kill()
    Logger.debug('AbstractProxy', 'destroy', 'begin')
  }

  protected prepareConnectionCleanup(sender: string) {
    // cleanup if client doesn't reconnect in time
    this.webSocketsTimeouts.set(
      sender,
      setTimeout(() => {
        MessageScheduler.instance.getAll(sender)
        this.webSocketsTimeouts.delete(sender)
      }, this.timeout)
    )
  }

  protected removeConnectionCleanup(sender: string) {
    // reset cleanup if client recconects in time
    clearTimeout(this.webSocketsTimeouts.get(sender))
    this.webSocketsTimeouts.delete(sender)
  }
}
