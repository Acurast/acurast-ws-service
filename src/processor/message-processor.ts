import { type Message } from '@acurast/transport-websocket'

interface BaseProcessorAction<T extends string> {
  type: T
}

export interface RegisterProcessorAction extends BaseProcessorAction<'register'> {
  sender: Uint8Array
  message?: Message
}

export interface RespondProcessorAction extends BaseProcessorAction<'respond'> {
  message: Message
}

export interface SendProcessorAction extends BaseProcessorAction<'send'> {
  message: Message
}

export type ProcessorAction = RegisterProcessorAction | RespondProcessorAction | SendProcessorAction

export interface MessageProcessor {
  processMessage(message: Message): Promise<ProcessorAction | undefined>
  onClosed(sender: Uint8Array): Promise<void>
}
