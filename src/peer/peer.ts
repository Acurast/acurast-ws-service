import { PeerHandlers } from "./peer-handlers"

export interface Peer {
  stop: () => void
  send: (sender: PeerHandlers, payload: Uint8Array) => void
  listen: (recipient: string) => void
  removeListener: (sender: string) => void
}
