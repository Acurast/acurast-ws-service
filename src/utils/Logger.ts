import { log } from '@acurast/transport-websocket'
import { proxyConfigReader } from '../proxy-reader'

export class Logger {
  private static readonly isDebugEnabled: boolean = proxyConfigReader<boolean>('debug', false)
  private static queue: { id: string; start: number }[] = []

  static log(...data: any[]): void {
    log('[PROXY]', ...data)
  }

  static debug(className: string, methodName: string, prefix: 'begin' | 'end', ...data: any): void {
    if (!this.isDebugEnabled) {
      return
    }

    const id = `${className}.${methodName}`

    if (prefix === 'begin') {
      this.queue.push({ id, start: performance.now() })
      log(
        '[DEBUG]',
        className,
        methodName,
        prefix,
        ...data,
        `timestamp = ${Date.now()} ms`
      )
      return
    }

    const last = this.queue.pop()

    log(
      '[DEBUG]',
      className,
      methodName,
      prefix,
      ...data,
      `duration = ${(last ? performance.now() - last.start : 0).toFixed(3)} ms`
    )
  }
}
