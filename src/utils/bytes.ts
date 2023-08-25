export function hexFrom(value: ArrayBuffer | Uint8Array | Buffer): string {
  const buffer: Buffer = Buffer.isBuffer(value) ? value : Buffer.from(value)
  return buffer.toString('hex')
}
