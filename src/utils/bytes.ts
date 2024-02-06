export function hexFrom(value: ArrayBuffer | Uint8Array | Buffer): string {
  const buffer: Buffer = Buffer.isBuffer(value) ? value : Buffer.from(value)
  return buffer.toString('hex')
}

export function hexTo(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'hex'))
}

export function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64)
  const len = binaryString.length
  const uint8Array = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    uint8Array[i] = binaryString.charCodeAt(i)
  }

  return uint8Array
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
  let binaryString = ''
  uint8Array.forEach((byte) => {
    binaryString += String.fromCharCode(byte)
  })

  return btoa(binaryString)
}
