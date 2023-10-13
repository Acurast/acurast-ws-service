import { AbstractScheduler } from './abstract-scheduler'
import { MessageElement } from './message-element'

export class MessageScheduler extends AbstractScheduler<MessageElement> {
  private static _instance: MessageScheduler = new MessageScheduler()

  private constructor() {
    super()
  }

  static get instance() {
    return this._instance
  }
}
