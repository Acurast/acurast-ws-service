import WebSocket from 'ws'
import { AbstractJob } from '../abstract-job'
import { Logger } from '../../utils/Logger'
import { ConnectionData } from '../../connection-data/connection-data'
import { isWSConnectionOpen } from '../../utils/ws'

export class CleanupJob extends AbstractJob {
  protected override scheduledTime: string = '0 * * * *'

  constructor(
    private source: Map<string, WebSocket>,
    private lastMessage: Map<string, number>,
    private webSocketsData: Map<string, ConnectionData>
  ) {
    super()
  }

  private free(key: string) {
    this.source.delete(key)
    this.lastMessage.delete(key)
    this.webSocketsData.delete(key)
  }

  protected override run(): void {
    const validationSet = new Set()

    for (const [key, ws] of this.source.entries()) {
      if (!ws || !this.lastMessage.has(key) || validationSet.has(ws) || !isWSConnectionOpen(ws)) {
        Logger.warn(`Memory leak detected. Deleting entry ${key}`)
        this.free(key)
        continue
      }

      if (Date.now() - this.lastMessage.get(key)! >= 600_000) {
        Logger.warn(`Connection timed out for entry: ${key}`)
        ws?.close(1008, 'The connection timed out.')
        continue
      }

      validationSet.add(ws)
    }
  }
}
