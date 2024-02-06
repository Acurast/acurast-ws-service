import { Message } from "@acurast/transport-websocket"

export interface SchedulerElement {
  timestamp: number
}

export interface MessageElement extends SchedulerElement {
  message: Message
}
