/* eslint-disable no-console */

import * as lp from 'it-length-prefixed'
import map from 'it-map'
import { pipe } from 'it-pipe'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'

export class StreamUtils {
  static fromStringToUint8Array(text: string) {
    return fromString(text)
  }

  static fromUint8ArraytoString(buffer: Uint8Array) {
    return toString(buffer)
  }
  
  static write(stream: any, message: string) {
    pipe(
      // make message iterable
      [message],
      // Turn strings into buffers
      (source) => map(source, (string) => fromString(string)),
      // Encode with length prefix (so receiving side knows how much data is coming)
      (source) => lp.encode(source),
      // Write to the stream (the sink)
      stream.sink
    )
  }

  static read(stream: any, callBack: Function) {
    pipe(
      // Read from the stream (the source)
      stream.source,
      // Decode length-prefixed data
      (source) => lp.decode(source),
      // Turn buffers into strings
      (source) => map(source, (buf) => toString(buf.subarray())),
      // Sink function
      async function (source) {
        // For each chunk of data
        for await (const msg of source) {
          // Output the data as a utf8 string
          callBack(msg)
        }
      }
    )
  }
}
