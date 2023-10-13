export interface SchedulerElement {
  timestamp: number
}

export interface MessageElement extends SchedulerElement {
  message: Uint8Array
}
