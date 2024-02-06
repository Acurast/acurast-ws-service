import { proxyConfigReader } from '../proxy-reader'
// import { hexTo } from '../utils/bytes'

const dynamicLoader = async () => ({
  createFromJson: (await import('@libp2p/peer-id-factory')).createFromJSON
})

export class PeerIdBuilder {
  static async build(): Promise<any> {
    const { createFromJson } = await dynamicLoader()
    const id = proxyConfigReader('peerId', undefined)

    if (!id) {
      return undefined
    }

    return await createFromJson(id)
  }
}
