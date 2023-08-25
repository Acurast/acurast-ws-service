import { forgeMessage, type Message, parseMessage, log } from '@acurast/transport-websocket'
import type WebSocket from 'ws'

import {
  type MessageProcessor,
  type RegisterProcessorAction,
  type ProcessorAction,
  type SendProcessorAction,
  type RespondProcessorAction
} from './processor/message-processor'
import { V1MessageProcessor } from './processor/v1-message-processor'
import { hexFrom } from './utils/bytes'

export class Proxy {
  private readonly processors: Record<number, MessageProcessor> = {
    1: new V1MessageProcessor()
  }

  private readonly webSockets: Map<string, WebSocket> = new Map()
  private readonly webSocketsReversed: Map<WebSocket, string> = new Map()

  public async onMessage(ws: WebSocket, bytes: Buffer): Promise<void> {
    const message: Message | undefined = parseMessage(bytes)
    if (message === undefined) {
      this.log('Message', bytes, 'not recognized')
      return
    }

    this.log('Got message', message)

    const processor: MessageProcessor | undefined = this.processors[message.version]
    if (processor === undefined) {
      this.log('Message version', message.version, 'not supported')
      return
    }

    const action: ProcessorAction | undefined = await processor.processMessage(message)
    switch (action?.type) {
      case 'register':
        await this.onRegister(action, ws)
        break
      case 'respond':
        await this.onRespond(action, ws)
        break
      case 'send':
        await this.onSend(action)
        break
    }
  }

  public reset(code: number, reason: string, ws: WebSocket): void {
    const sender: string | undefined = this.webSocketsReversed.get(ws)
    this.webSocketsReversed.delete(ws)
    if (sender !== undefined) {
      const details: string = reason.length > 0 ? `${code}: ${reason}` : code.toString()
      this.log(sender, `closed connection (${details})`)

      this.webSockets.delete(sender)
      Object.values(this.processors).forEach((processor: MessageProcessor) => {
        void processor.onClosed(Buffer.from(sender, 'hex'))
      })
    }
  }

  private async onRegister(action: RegisterProcessorAction, ws: WebSocket): Promise<void> {
    const sender: string = hexFrom(action.sender)
    this.webSockets.set(sender, ws)
    this.webSocketsReversed.set(ws, sender)

    if (action.message !== undefined) {
      try {
        await this.send(ws, action.message)
      } catch (error) {
        console.error(error)
      }
    }
  }

  private async onRespond(action: RespondProcessorAction, ws: WebSocket): Promise<void> {
    try {
      await this.send(ws, action.message)
    } catch (error) {
      console.error(error)
    }
  }

  private async onSend(action: SendProcessorAction): Promise<void> {
    const recipient: string = hexFrom(action.message.recipient)

    this.log('Sending', action.message, 'to', recipient)

    const ws: WebSocket | undefined = this.webSockets.get(recipient)
    if (ws === undefined) {
      this.log(recipient, 'not connected')
      return
    }

    try {
      await this.send(ws, action.message)
      this.log('Sent', action.message, 'to', recipient, 'successfully')
    } catch (error) {
      this.log('Sending', action.message, 'to', recipient, 'failed', error)
    }
  }

  private async send(ws: WebSocket, message: Message): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      ws.send(forgeMessage(message), (error: Error | undefined | null) => {
        if (error !== undefined && error !== null) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  private log(...data: any[]): void {
    log('[PROXY]', ...data)
  }
}
