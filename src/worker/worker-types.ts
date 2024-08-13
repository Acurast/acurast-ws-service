import { Message } from '@acurast/transport-websocket'
import { ProcessorAction } from '../processor/message-processor'

export type ProcessorWorkerRequest = {
  message: Message
  senderId: string
}

export type ProcessorWorkerResponse = {
  action?: ProcessorAction
  senderId: string
}

export enum ListenerWorkerAction {
  SUBSCRIBE,
  UNSUBSCRIBE,
  PUBLISH
}

export type ListenerWorkerRequest = {
  action: ListenerWorkerAction
  topic: string
  message?: Uint8Array
}

export type WorkerError = {
  error: true
  message: string
  data?: any
}

export enum WorkerType {
  PROCESSOR,
  LISTENER
}
