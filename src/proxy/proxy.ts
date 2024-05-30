import { forgeMessage, type Message, parseMessage, InitMessage } from '@acurast/transport-websocket'
import type WebSocket from 'ws'
import * as Sentry from '@sentry/node'

import {
  type MessageProcessor,
  type RegisterProcessorAction,
  type SendProcessorAction,
  type RespondProcessorAction
} from '../processor/message-processor'
import { hexFrom } from '../utils/bytes'
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
      ? this.webSockets.get(senderId)!
      : this.pendingConnections.get(senderId)!

    switch (action?.type) {
      case 'register':
        this.onRegister(action, ws)
        break
      case 'respond':
        this.onRespond(action, ws)
        break
      case 'send':
        this.onSend(action)
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
      return
    }

    Logger.log('Got message', message)

    if (message.type === 'init') {
      this.pendingConnections.set(senderStr, ws)
      this.prepareConnectionCleanup(senderStr, () => {
        this.pendingConnections.delete(senderStr)
        ws.close(1008, 'The connection timed out.')
      })
    } else {
      this.websocketsLastMessage.set(ws, Date.now())
    }

    this.pool.postMessage(WorkerType.PROCESSOR, {
      message,
      senderId: senderStr
    })

    Logger.debug('Proxy', 'onMessage', 'end')
  }

  reset(code: number, reason: string, ws: WebSocket): void {
    Logger.debug('Proxy', 'reset', 'begin')

    const sender = this.webSocketsReversed.get(ws)!

    if (!sender) {
      Logger.warn('Proxy', 'reset', 'the connection is already closed')
      return
    }

    const details: string = reason.length > 0 ? `${code}: ${reason}` : code.toString()
    Logger.log(sender, `closed connection (${details})`)

    this.onReset(sender, ws)
    
    this.pool.postMessage(WorkerType.LISTENER, {
      action: ListenerWorkerAction.UNSUBSCRIBE,
      topic: sender
    })
    Object.values(this.processors).forEach((processor: MessageProcessor) => {
      void processor.onClosed(Buffer.from(sender, 'hex'))
    })

    this.prepareConnectionCleanup(sender)

    Logger.debug('Proxy', 'reset', 'end')
  }

  private onRegister(action: RegisterProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRegister', 'begin')
    const sender: string = hexFrom(action.sender)

    if (this.webSockets.has(sender)) {
      this.webSockets.get(sender)?.close(1008, 'New connection received.')
      return
    }

    this.removeConnectionCleanup(sender)

    this.webSockets.set(sender, ws)
    this.pendingConnections.delete(sender)
    this.webSocketsReversed.set(ws, sender)
    this.websocketsLastMessage.set(ws, Date.now())
    this.webSocketsData.set(
      sender,
      ConnectionDataInitializer.initialize(action.message as InitMessage)
    )

    this.pool.postMessage(WorkerType.LISTENER, {
      action: ListenerWorkerAction.SUBSCRIBE,
      topic: sender
    })

    if (!action.message) {
      return
    }

    this.send(ws, action.message)
    MessageScheduler.instance.getAll(sender)?.forEach((msg) => this.send(ws, msg.message))
    Logger.debug('Proxy', 'onRegister', 'end')
  }

  private onRespond(action: RespondProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRespond', 'begin')
    this.send(ws, action.message)
    Logger.debug('Proxy', 'onRespond', 'end')
  }

  private onSend(action: SendProcessorAction): void {
    Logger.debug('Proxy', 'onSend', 'begin')
    const recipient: string = hexFrom(action.message.recipient)

    Logger.log('Sending', action.message, 'to', recipient)

    if (this.webSockets.has(recipient)) {
      this.send(this.webSockets.get(recipient)!, action.message)
    } else {
      this.pool.postMessage(WorkerType.LISTENER, {
        action: ListenerWorkerAction.PUBLISH,
        topic: recipient,
        message: action.message
      })
    }

    Logger.log('Sent', action.message, 'to', recipient, 'successfully')
    Logger.debug('Proxy', 'onSend', 'end')
  }

  private send(ws: WebSocket, message: Message): void {
    Logger.debug('Proxy', 'send', 'begin')
    try {
      ws.send(forgeMessage(message))
    } catch (err: any) {
      Logger.error('Sending', message, 'to', message.recipient, 'failed', err.message)
      this.prepareConnectionCleanup(hexFrom(message.sender))
      Sentry.captureException(err)
    }
    Logger.debug('Proxy', 'send', 'end')
  }
}
