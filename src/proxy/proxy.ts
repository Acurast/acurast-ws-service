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

export class Proxy extends AbstractProxy {
  protected override onNetworkMessage({ id, message }: PeerEvent<Uint8Array>): void {
    Logger.debug('Proxy', 'onNetworkMessage', 'begin')
    if (!this.webSockets.has(id)) {
      return
    }

    MessageScheduler.instance.add(id, { message: parseMessage(message)!, timestamp: Date.now() })
    this.webSockets.get(id)?.send(message)
    Logger.debug('Proxy', 'onNetworkMessage', 'end')
  }

  public onMessage(ws: WebSocket, bytes: Buffer) {
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

    processor
      .processMessage(message)
      .then((action) => {
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
      })
      .catch((err) => {
        Logger.error(err.message)
        Sentry.captureException(err)
      })

    Logger.debug('Proxy', 'onMessage', 'end')
  }

  public reset(code: number, reason: string, ws: WebSocket): void {
    Logger.debug('Proxy', 'reset', 'begin')
    const sender: string | undefined = this.webSocketsReversed.get(ws)
    this.webSocketsReversed.delete(ws)

    if (!sender) {
      return
    }

    const details: string = reason.length > 0 ? `${code}: ${reason}` : code.toString()
    Logger.log(sender, `closed connection (${details})`)

    this.webSockets.delete(sender)
    this.webSocketsData.delete(sender)
    this.listener.removeListener(sender)
    Object.values(this.processors).forEach((processor: MessageProcessor) => {
      void processor.onClosed(Buffer.from(sender, 'hex'))
    })

    this.prepareConnectionCleanup(sender)

    Logger.debug('Proxy', 'reset', 'end')
  }

  private onRegister(action: RegisterProcessorAction, ws: WebSocket): void {
    Logger.debug('Proxy', 'onRegister', 'begin')
    const sender: string = hexFrom(action.sender)

    this.removeConnectionCleanup(sender)

    this.webSockets.set(sender, ws)
    this.webSocketsReversed.set(ws, sender)
    this.webSocketsData.set(
      sender,
      ConnectionDataInitializer.initialize(action.message as InitMessage)
    )
    this.listener.listen(sender)

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

    this.listener.send(recipient, forgeMessage(action.message)).catch((err: any) => {
      Logger.error(err.message)
      this.prepareConnectionCleanup(hexFrom(action.message.sender))
      Sentry.captureException(err)
    })

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
