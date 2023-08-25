import crypto from 'crypto'
import { ec as EC } from 'elliptic'

export class Crypto {
  public getRandomValues(size: number): Buffer {
    return crypto.randomBytes(size)
  }

  public sha256(data: Uint8Array): Buffer {
    const hash = crypto.createHash('sha256')
    hash.update(data)
    return hash.digest()
  }

  public verifyP256(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    const ec = new EC('p256')
    return ec.keyFromPublic(publicKey).verify(data, {
      r: signature.subarray(0, 32),
      s: signature.subarray(32)
    })
  }
}
