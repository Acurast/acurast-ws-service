/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai'

import { Crypto } from '../../src/crypto'

describe('Crypto', function() {
  it('creates random bytes', function() {
    const size: number = 16

    const crypto = new Crypto()
    const a: Buffer = crypto.getRandomValues(size)
    const b: Buffer = crypto.getRandomValues(size)

    expect(a.length).eq(size)
    expect(b.length).eq(size)
    expect(a.toString('hex')).not.eq(b.toString('hex'))
  })

  it('creates SHA-256 hash', function() {
    const data: Buffer = Buffer.from('90cace2932470ec1af20c53ae24abfce', 'hex')

    const crypto = new Crypto()
    const hash: Buffer = crypto.sha256(data)

    expect(hash.toString('hex')).eq(
      '1fe2cb1a03f0d66b31da77084822e5b3d9d7460c017a90d870ca5c5c30fa1783'
    )
  })

  it('verifies a valid P-256 signature', function() {
    const data: Buffer = Buffer.from(
      'bb67a3ba9ac64fb89ab480f634755f0d92c263f980b8705dbb24b3010a3b1e69',
      'hex'
    )
    const signature: Buffer = Buffer.from(
      'e0fdb186b140de795f73c30ed8c269a2a71ba4c062502c8befe85d38044fd9ec4a3246b6ba7fb06045a2d121e4f6c8e2aa90be01b5a96502e8e53407bbb13bc2',
      'hex'
    )
    const publicKey: Buffer = Buffer.from(
      '0397e0c76ca850349cfb7684121c5fc7516f7ff3300bf047631cc8e6b155b56758',
      'hex'
    )

    const crypto = new Crypto()
    const verified: boolean = crypto.verifyP256(data, signature, publicKey)

    expect(verified).to.be.true
  })

  it('verifies an invalid P-256 signature', function() {
    const data: Buffer = Buffer.from(
      'bb67a3ba9ac64fb89ab480f634755f0d92c263f980b8705dbb24b3010a3b1e69',
      'hex'
    )
    const signature: Buffer = Buffer.from(
      '3c1c7c51f8ceddc31e6c81a46b3147b52cfa34bf9639af0b541f7eb94ea9356e729ef2d57c8dbe686a87b55695643d8fa4af50e17fb32808e0e9c94a315a763a',
      'hex'
    )
    const publicKey: Buffer = Buffer.from(
      '0397e0c76ca850349cfb7684121c5fc7516f7ff3300bf047631cc8e6b155b56758',
      'hex'
    )

    const crypto = new Crypto()
    const verified: boolean = crypto.verifyP256(data, signature, publicKey)

    expect(verified).to.be.false
  })
})
