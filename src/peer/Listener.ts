import { AbstractPeer } from './abstract-peer.js'
import { StreamUtils } from '../utils/stream-utils.js'

export class Listener extends AbstractPeer {
  private onNetworkMessage: (message: Uint8Array) => void

  constructor(onNetworkMessage: (message: Uint8Array) => void) {
    super()
    this.onNetworkMessage = onNetworkMessage
  }

  protected override onPeerDiscoveryHandler(evt: CustomEvent<any>): void {
    console.log('Peer discovered: ', evt.detail.id.toString())
  }
  protected override onPeerConnectHandler(evt: CustomEvent<any>): void {
    console.log('Peer connected: ', evt.detail.toString())
  }

  private async onMessageForwarded(message: string) {
    this.onNetworkMessage(await StreamUtils.fromStringToUint8Array(message))
  }

  protected async run(): Promise<void> {
    const node = await this.start()

    await node.handle('/forward-message', async ({ connection, stream }: any) => {
      console.log(`${node.peerId}/client-discovery: request received from ${connection.remotePeer}`)
      StreamUtils.read(stream, this.onMessageForwarded)
    })

    console.log('Listener ready, listening on:')
    node.getMultiaddrs().forEach((addr: any) => console.log(addr.toString()))
  }
}
