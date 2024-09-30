import { forgeMessage, type Message, parseMessage, InitMessage } from '@acurast/transport-websocket'
import type WebSocket from 'ws'

import {
  type MessageProcessor,
  type RegisterProcessorAction,
  type RespondProcessorAction
} from '../processor/message-processor'
import { hexFrom, hexTo } from '../utils/bytes'
import Permissions from '../permissions/permissions'
import { ConnectionDataInitializer } from '../connection-data/connection-data-initializer'
import { AbstractProxy } from './abstract-proxy'
import { Logger } from '../utils/Logger'
import { PeerEvent } from '../peer/peer-event'
import { MessageScheduler } from '../scheduler/message-scheduler'
import {
  ListenerWorkerAction,
  ProcessorWorkerResponse,
  WorkerError,
  WorkerType
} from '../worker/worker-types'
import { isWSConnectionOpen } from '../utils/ws'

export class Proxy extends AbstractProxy {
  protected override processorWorkerHandler(data: ProcessorWorkerResponse | WorkerError): void {
    const err = data as WorkerError

    if (err.error && this.pendingConnections.has(err.message)) {
      this.pendingConnections.get(err.message)?.close(1011, 'Challenge failed.')
      this.pendingConnections.delete(err.message)
      return
    }

    const { action, senderId } = data as ProcessorWorkerResponse

    const ws = this.webSockets.has(senderId)
      ? this.webSockets.get(senderId)
      : this.pendingConnections.get(senderId)

    if (!ws || !isWSConnectionOpen(ws)) {
      Logger.warn(`${senderId} the connection is closed`)
      this.onReset(senderId)
      return
    }

    switch (action?.type) {
      case 'register':
        this.onRegister(action, ws)
        break
      case 'respond':
        this.onRespond(action, ws)
        break
      case 'send':
        this.send(action.message)
        break
      default:
        break
    }
  }

  protected override listenerWorkerHandler(data: WorkerError | PeerEvent<Uint8Array>): void {
    const err = data as WorkerError

    if (err.error) {
      return
    }

    this.onNetworkMessage(data as PeerEvent<Uint8Array>)
  }

  protected override onNetworkMessage({ id, message }: PeerEvent<Uint8Array>): void {
    Logger.debug('Proxy', 'onNetworkMessage', 'begin')
    if (id === 'NEW_REGISTRATION') {
      const sender = hexFrom(message)
      const ws = this.webSockets.get(sender)

      if (this.webSockets.has(sender) && !isWSConnectionOpen(ws)) {
        this.onReset(sender)
        return
      }

      ws?.close(1008, 'New connection received.')
      MessageScheduler.instance.getAll(sender)?.forEach((msg) =>
        this.pool.postMessage(WorkerType.LISTENER, {
          action: ListenerWorkerAction.PUBLISH,
          topic: sender,
          message: forgeMessage(msg.message)
        })
      )

      return
    }

    if (!this.webSockets.has(id)) {
      return
    }

    MessageScheduler.instance.add(id, { message: parseMessage(message)!, timestamp: Date.now() })
    this.webSockets.get(id)?.send(message)
    Logger.debug('Proxy', 'onNetworkMessage', 'end')
  }

  onMessage(ws: WebSocket, bytes: Buffer) {
    Logger.debug('Proxy', 'onMessage', 'begin')
    const message: Message | undefined = parseMessage(bytes)
    if (message === undefined) {
      Logger.log('Message', bytes, 'not recognized')
      return
    }
    const senderStr = hexFrom(message.sender)
    const data = this.webSocketsData.get(senderStr) ?? {}

    if (
      !Permissions.isAllowed(
        senderStr,
        data.permissions?.allowList ?? [],
        data.permissions?.denyList ?? []
      )
    ) {
      Logger.log('Access denied.')
      ws.close(1008, 'Access denied.')
      return
    }

    if (!ws.isPaused && this.limiter.limitRequest(ws)) {
      Logger.warn(`${senderStr} is sending too many messages. Suspending...`)
    }

    Logger.log('Got message', message)

    if (message.type === 'init') {
      this.pendingConnections.set(senderStr, ws)
      this.prepareConnectionCleanup(senderStr, () => {
        this.pendingConnections.delete(senderStr)
        ws.close(1008, 'The connection timed out.')
      })
    } else {
      this.websocketsLastMessage.set(hexFrom(message.sender), Date.now())
    }

    this.pool.postMessage(WorkerType.PROCESSOR, {
      message,
      senderId: senderStr
    })

    Logger.debug('Proxy', 'onMessage', 'end')
  }

  reset(code: number, reason: string, ws: WebSocket): void {
    Logger.debug('Proxy', 'reset', 'begin')

    const result = Array.from(this.webSockets.entries()).find(([_, value]) => ws === value)

    if (!result) {
      Logger.warn('Proxy', 'reset', 'the connection is already closed')
      return
    }

    const [sender] = result
    const details: string = reason.length > 0 ? `${code}: ${reason}` : code.toString()
    Logger.log(sender, `closed connection (${details})`)

    this.onReset(sender)

    Object.values(this.processors).forEach((processor: MessageProcessor) => {
      void processor.onClosed(Buffer.from(sender, 'hex'))
    })

    this.prepareConnectionCleanup(sender, () => {
      this.pool.postMessage(WorkerType.LISTENER, {
        action: ListenerWorkerAction.UNSUBSCRIBE,
        topic: sender
      })
    })

    Logger.debug('Proxy', 'reset', 'end')
  }

  private onRegister(action: RegisterProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRegister', 'begin')
    const sender: string = hexFrom(action.sender)

    if (this.webSockets.has(sender)) {
      Logger.warn(`${sender} is registering again.`)
      this.onReset(sender)
    }

    this.removeConnectionCleanup(sender)

    this.webSockets.set(sender, ws)
    this.pendingConnections.delete(sender)
    this.websocketsLastMessage.set(sender, Date.now())
    this.webSocketsData.set(
      sender,
      ConnectionDataInitializer.initialize(action.message as InitMessage)
    )

    this.pool.postMessage(WorkerType.LISTENER, {
      action: ListenerWorkerAction.SUBSCRIBE,
      topic: sender
    })

    this.pool.postMessage(WorkerType.LISTENER, {
      action: ListenerWorkerAction.PUBLISH,
      topic: 'NEW_REGISTRATION',
      message: hexTo(sender)
    })

    if (!action.message) {
      return
    }

    ws.send(forgeMessage(action.message))
    MessageScheduler.instance.getAll(sender)?.forEach((msg) => ws.send(forgeMessage(msg.message)))
    Logger.debug('Proxy', 'onRegister', 'end')
  }

  private onRespond(action: RespondProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRespond', 'begin')
    ws?.send(forgeMessage(action.message))
    Logger.debug('Proxy', 'onRespond', 'end')
  }

  private send(message: Message): void {
    Logger.debug('Proxy', 'send', 'begin')
    const recipient = hexFrom(message.recipient)
    const parsed = forgeMessage(message)
    const socket = this.webSockets.get(recipient)

    if (socket) {
      MessageScheduler.instance.add(recipient, { message, timestamp: Date.now() })
      socket.send(parsed)
    } else {
      this.pool.postMessage(WorkerType.LISTENER, {
        action: ListenerWorkerAction.PUBLISH,
        topic: recipient,
        message: parsed
      })
    }
  }
}
