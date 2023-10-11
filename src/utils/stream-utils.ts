/* eslint-disable no-console */

import { hexFrom, hexTo } from './bytes'

const dynamicLoader = async (): Promise<any> => {
  return {
    lp: await import('it-length-prefixed'),
    map: (await import('it-map')).default,
    pipe: (await import('it-pipe')).pipe
  }
}

export class StreamUtils {
  static async write(stream: any, message: string) {
    const { pipe, map, lp } = await dynamicLoader()

    pipe(
      // make message iterable
      [message],
      // Turn strings into buffers
      (source: any) => map(source, (string: string) => hexTo(string)),
      // Encode with length prefix (so receiving side knows how much data is coming)
      (source: any) => lp.encode(source),
      // Write to the stream (the sink)
      stream.sink
    )
  }

  static async read(stream: any, callBack: Function) {
    const { pipe, map, lp } = await dynamicLoader()

    pipe(
      // Read from the stream (the source)
      stream.source,
      // Decode length-prefixed data
      (source: any) => lp.decode(source),
      // Turn buffers into strings
      (source: any) => map(source, (buf: any) => hexFrom(buf.subarray())),
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
