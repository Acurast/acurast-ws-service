import { AbstractPeer } from './abstract-peer'
import { Logger } from '../utils/Logger'

export class Listener extends AbstractPeer {
  constructor() {
    super()
  }

  protected override onPeerDiscoveryHandler(evt: CustomEvent<any>): void {
    Logger.log('Peer discovered: ', evt.detail.id.toString())
  }
  protected override onPeerConnectHandler(evt: CustomEvent<any>): void {
    const peerId = evt.detail.toString()
    Logger.log('Peer connected: ', peerId)
  }

  protected override async run(): Promise<void> {
    const node = await this.start()

    Logger.log('Listener ready, listening on:')
    node.getMultiaddrs().forEach((addr: any) => Logger.log(addr.toString()))
  }
}
