import { ConnectionData } from '../connection-data/connection-data'
import { MessageProcessor } from '../processor/message-processor'
import { V1MessageProcessor } from '../processor/v1-message-processor'
import WebSocket from 'ws'
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
  protected readonly websocketsLastMessage: Map<WebSocket, number> = new Map()

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

  protected abstract processorWorkerHandler(data: ProcessorWorkerResponse | WorkerError): void
  protected abstract listenerWorkerHandler(data: PeerEvent<Uint8Array> | WorkerError): void
  protected abstract onNetworkMessage(message: PeerEvent<Uint8Array>): void

  private connectionCleanup = setInterval(() => {
    const now = Date.now()

    for (const ws of this.webSocketsReversed.keys()) {
      if (!this.websocketsLastMessage.has(ws)) {
        ws.close(1008, 'The connection timed out') // it will trigger reset
        continue
      }

      const lastMessage = this.websocketsLastMessage.get(ws)

      if (!lastMessage) {
        ws.close(1008, 'The connection timed out')
        continue
      }

      if (lastMessage + 900000 <= now) {
        ws.close(1008, 'The connection timed out')
        continue
      }
    }
  }, 900000) // 15 minutes

  getMemorySnapshot() {
    const getLeaks = () => {
      const result = []
      for (const [id, ws] of this.webSockets.entries()) {
        if (!this.webSocketsReversed.has(ws)) {
          result.push(`${id} is missing from webSocketsReversed`)
        }
        if (!this.webSocketsData.has(id)) {
          result.push(`${id} is missing from webSocketsData`)
        }
        if (this.webSocketsTimeouts.has(id)) {
          result.push(`${id} was not freed from webSocketsTimeouts`)
        }
        if (!this.websocketsLastMessage.has(ws)) {
          result.push(`${id} is missing from websocketsLastMessage`)
        }
        if (this.pendingConnections.has(id)) {
          result.push(`${id} was not freed from pendingConnections`)
        }
      }

      return result
    }
    return {
      totalWebSockets: this.webSockets.size,
      totalReversed: this.webSocketsReversed.size,
      totalWebsocketsData: this.webSocketsData.size,
      totalWebSocketsTimeouts: this.webSocketsTimeouts.size,
      totalPendingConnections: this.pendingConnections.size,
      leaks: getLeaks()
    }
  }

  cleanup() {
    MessageScheduler.instance.cleanup()
  }

  destroy() {
    Logger.debug('AbstractProxy', 'destroy', 'begin')
    clearInterval(this.connectionCleanup)
    this.pool.kill()
    Logger.debug('AbstractProxy', 'destroy', 'begin')
  }

  protected prepareConnectionCleanup(sender: string, handler?: Function) {
    // cleanup if client doesn't reconnect in time
    this.webSocketsTimeouts.set(
      sender,
      setTimeout(() => {
        handler && handler()
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
