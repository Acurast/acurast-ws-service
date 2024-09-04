import { WebSocket } from 'ws'

export class RateLimiter {
  private limit: number
  private interval: number
  private now: number
  private lastSymbol: symbol
  private countSymbol: symbol

  constructor(limit: number, interval: number) {
    this.limit = limit
    this.interval = interval
    this.now = 0
    this.lastSymbol = Symbol('last')
    this.countSymbol = Symbol('count')
    this.startInterval()
  }

  private startInterval() {
    setInterval(() => {
      this.now++
    }, this.interval)
  }

  private resetCount(socket: any) {
    socket[this.lastSymbol] = this.now
    socket[this.countSymbol] = 1
  }

  private incrementCount(socket: any) {
    socket[this.countSymbol]++
  }

  private hasExceededLimit(socket: any): boolean {
    return socket[this.countSymbol] > this.limit
  }

  private pause(ws: WebSocket) {
    ws.pause()
    setTimeout(() => ws.resume(), this.interval)
  }

  limitRequest(ws: WebSocket): boolean {
    const socket = ws as any

    // Reset count if we're in a new interval
    if (socket[this.lastSymbol] !== this.now) {
      this.resetCount(socket)
      return false
    }

    // Increment the count and check if the limit is exceeded
    this.incrementCount(socket)

    if (this.hasExceededLimit(socket)) {
      this.pause(ws)
      return true
    }

    return false
  }
}
