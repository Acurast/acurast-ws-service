export interface Peer {
  stop: () => Promise<void>
  broadcast: (protocol: string, payload: Uint8Array) => Promise<void>
}
