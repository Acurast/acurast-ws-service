import cron, { ScheduledTask } from 'node-cron'
import { Job } from './job'

export abstract class AbstractJob implements Job {
  protected job: ScheduledTask | undefined
  protected scheduledTime: string = '0 8 * * *'

  constructor() {
    this.register()
  }

  protected abstract run(): void

  private register() {
    this.job = cron.schedule(
      this.scheduledTime,
      () => {
        this.run()
      },
      {
        timezone: 'Europe/Zurich'
      }
    )
  }

  kill() {
    this.job?.stop()
  }
}
