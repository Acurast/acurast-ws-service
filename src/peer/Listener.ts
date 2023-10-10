import { AbstractPeer } from './abstract-peer.js'
import { StreamUtils } from '../utils/stream-utils.js'
import WebSocket from 'ws'

export class Listener extends AbstractPeer {
  private addressingTable: Map<string, WebSocket>

  constructor(addressingTable: Map<string, WebSocket>) {
    super()
    this.addressingTable = addressingTable
  }

  protected override onPeerDiscoveryHandler(evt: CustomEvent<any>): void {
    console.log('Peer discovered: ', evt.detail)
  }
  protected override onPeerConnectHandler(evt: CustomEvent<any>): void {
    console.log('Peer connected: ', evt.detail)
  }

  private async onClientDiscovery(node: any, stream: any, id: string) {
    // todo typings
    if (!this.addressingTable.has(id)) {
      return
    }

    StreamUtils.write(stream, await StreamUtils.fromUint8ArraytoString(node.peerId))
  }

  protected async run(): Promise<void> {
    const node = await this.start()

    await node.handle('/client-discovery', async ({ connection, stream }: any) => {
      console.log(`${node.peerId}/client-discovery: request received from ${connection.remotePeer}`)
      StreamUtils.read(stream, this.onClientDiscovery.bind(this, node, stream))
    })

    console.log('Lisetenr ready, listening on:')
    node.getMultiaddrs().forEach((addr: any) => console.log(addr.toString()))
  }
}
