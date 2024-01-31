import { forgeMessage, type Message, parseMessage, InitMessage } from '@acurast/transport-websocket'
import type WebSocket from 'ws'
import * as Sentry from '@sentry/node'

import {
  type MessageProcessor,
  type RegisterProcessorAction,
  type ProcessorAction,
  type SendProcessorAction,
  type RespondProcessorAction
} from '../processor/message-processor'
import { hexFrom } from '../utils/bytes'
import { MessageScheduler } from '../scheduler/message-scheduler'
import Permissions from '../permissions/permissions'
import { ConnectionDataInitializer } from '../conection-data/connection-data-initializer'
import { AbstractProxy } from './abstract-proxy'
import { PeerHandlers } from '../peer/peer-handlers'
import { Logger } from '../utils/Logger'

export class Proxy extends AbstractProxy {
  protected override handleMessage(message: Uint8Array) {
    Logger.debug('Proxy', 'handleMessage', 'begin')
    const parsed = parseMessage(message)

    if (!parsed) {
      return
    }

    const recipient = hexFrom(parsed.recipient)
    const socket = this.webSockets.get(recipient)

    MessageScheduler.instance.cleanup()

    if (!socket) {
      MessageScheduler.instance.add(recipient, { message, timestamp: Date.now() })
    } else {
      this.listener.broadcast(PeerHandlers.MESSAGE_CLEANUP, parsed.recipient)
      socket.send(message)
    }
    Logger.debug('Proxy', 'handleMessage', 'end')
  }

  protected override cleanupMessages(sender: Uint8Array): void {
    Logger.debug('Proxy', 'cleanupMessages', 'begin')
    MessageScheduler.instance.getAll(hexFrom(sender))
    Logger.debug('Proxy', 'cleanupMessages', 'end')
  }

  public async onMessage(ws: WebSocket, bytes: Buffer): Promise<void> {
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

    const processor: MessageProcessor | undefined = this.processors[message.version]
    if (processor === undefined) {
      Logger.log('Message version', message.version, 'not supported')
      return
    }

    const action: ProcessorAction | undefined = await processor.processMessage(message)
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
    }
    Logger.debug('Proxy', 'onMessage', 'end')
  }

  public reset(code: number, reason: string, ws: WebSocket): void {
    Logger.debug('Proxy', 'reset', 'begin')
    const sender: string | undefined = this.webSocketsReversed.get(ws)
    this.webSocketsReversed.delete(ws)
    if (sender !== undefined) {
      const details: string = reason.length > 0 ? `${code}: ${reason}` : code.toString()
      Logger.log(sender, `closed connection (${details})`)

      this.webSockets.delete(sender)
      this.webSocketsData.delete(sender)
      Object.values(this.processors).forEach((processor: MessageProcessor) => {
        void processor.onClosed(Buffer.from(sender, 'hex'))
      })
    }
    Logger.debug('Proxy', 'reset', 'end')
  }

  private onRegister(action: RegisterProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRegister', 'begin')
    const sender: string = hexFrom(action.sender)
    this.webSockets.set(sender, ws)
    this.webSocketsReversed.set(ws, sender)
    this.webSocketsData.set(
      sender,
      ConnectionDataInitializer.initialize(action.message as InitMessage)
    )

    if (!action.message) {
      return
    }

    this.send(ws, action.message)

    MessageScheduler.instance.getAll(sender)?.forEach((msg) => ws.send(msg.message))
    this.listener.broadcast(PeerHandlers.MESSAGE_CLEANUP, action.sender)
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

    const ws: WebSocket | undefined = this.webSockets.get(recipient)

    if (ws === undefined) {
      if (action.message.type === 'payload') {
        const message = forgeMessage(action.message)
        MessageScheduler.instance.add(recipient, { message, timestamp: Date.now() })
        this.listener.broadcast(PeerHandlers.FOWARD_MESSAGE, message)
      }
      return
    }

    this.send(ws, action.message)

    Logger.log('Sent', action.message, 'to', recipient, 'successfully')
    Logger.debug('Proxy', 'onSend', 'end')
  }

  private send(ws: WebSocket, message: Message): void {
    Logger.debug('Proxy', 'send', 'begin')
    try {
      ws.send(forgeMessage(message))
    } catch (err: any) {
      Logger.error('Sending', message, 'to', message.recipient, 'failed', err.message)
      Sentry.captureException(err)
    }
    Logger.debug('Proxy', 'send', 'end')
  }
}
