import WebSocket from 'ws'
import { AbstractJob } from '../abstract-job'
import { Logger } from '../../utils/Logger'

export class CleanupJob extends AbstractJob {
  protected override scheduledTime: string = '0 * * * *'
  
  constructor(
    private source: Map<string, WebSocket>,
    private target: Map<WebSocket, string>,
    private group: Map<string, any>[]
  ) {
    super()
  }

  protected override run(): void {
    Logger.log('Running WebSocket cleanup...')

    Array.from(this.source.entries()).forEach(([key, ws]) => {
      if (!this.target.has(ws)) {
        this.free(key)
        this.source.delete(key)
        ws?.close(1006, 'Connection not freed correctly')
      }
    })

    Logger.log('Done Running WebSocket cleanup.')
  }

  private free(key: string) {
    this.group.forEach((map) => map.delete(key))
  }
}
