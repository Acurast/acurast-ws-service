export enum PeerEventType {
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  MESSAGE_CLEANUP = 'MESSAGE_CLEANUP'
}

export type PeerEvent<T> = {
  type: PeerEventType
  message: T
}
