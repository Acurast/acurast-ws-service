/* eslint-disable no-console */

export const dynamicLoader = async (): Promise<any> => {
  return {
    lp: await import('it-length-prefixed'),
    map: (await import('it-map')).default,
    pipe: (await import('it-pipe')).pipe,
    fromString: (await import('uint8arrays/from-string')).fromString,
    toString: (await import('uint8arrays/to-string')).toString
  }
}

export class StreamUtils {
  static async fromStringToUint8Array(text: string) {
    const { fromString } = await dynamicLoader()

    return fromString(text)
  }

  static async fromUint8ArraytoString(buffer: Uint8Array) {
    const { toString } = await dynamicLoader()

    return toString(buffer)
  }

  static async write(stream: any, message: string) {
    const { pipe, map, fromString, lp } = await dynamicLoader()

    pipe(
      // make message iterable
      [message],
      // Turn strings into buffers
      (source: any) => map(source, (string: string) => fromString(string)),
      // Encode with length prefix (so receiving side knows how much data is coming)
      (source: any) => lp.encode(source),
      // Write to the stream (the sink)
      stream.sink
    )
  }

  static async read(stream: any, callBack: Function) {
    const { pipe, map, toString, lp } = await dynamicLoader()

    pipe(
      // Read from the stream (the source)
      stream.source,
      // Decode length-prefixed data
      (source: any) => lp.decode(source),
      // Turn buffers into strings
      (source: any) => map(source, (buf: any) => toString(buf.subarray())),
      // Sink function
      async function (source: any) {
        // For each chunk of data
        for await (const msg of source) {
          // Output the data as a utf8 string
          callBack(msg)
        }
      }
    )
  }
}
