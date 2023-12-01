import { proxyConfigReader } from '../proxy-reader'
import { SchedulerElement } from './scheduler-element'

export abstract class AbstractScheduler<T extends SchedulerElement> {
  private queue: Map<string, T[]> = new Map()
  private lastCleanup: number = 0
  timeframe: number = proxyConfigReader('schedulerTimeframe', 60000)

  /**
   * Removes all expired entries
   */
  cleanup() {
    const now = Date.now()

    if (now - this.lastCleanup <= this.timeframe) {
      return
    }

    Array.from(this.queue.keys()).forEach((key) => {
      const list = this.queue.get(key)!.filter((msg) => now - msg.timestamp <= this.timeframe)

      if (!list.length) {
        this.queue.delete(key)
      } else {
        this.queue.set(key, list)
      }
    })

    this.lastCleanup = now
  }
  /**
   * Add an entry to the queue
   * @param key unique id
   * @param entry a SchedulerElement object
   */
  add(key: string, entry: T) {
    if (this.queue.has(key)) {
      this.queue.get(key)!.push(entry)
    } else {
      this.queue.set(key, [entry])
    }
  }

  /**
   * Append an array of objects
   * @param key uinque id
   * @param entries a list of SchedulerElement objects
   */
  addAll(key: string, entries: T[]) {
    entries.forEach((entry) => this.add(key, entry))
  }

  /**
   * @param key unique id
   * @returns the latest inserted entry and removes it from the queue
   */
  getLatest(key: string) {
    return this.queue.get(key)?.pop()
  }

  /**
   * @param key unique id
   * @returns the oldest inserted entry and removes it from the queue
   */
  getOldest(key: string) {
    return this.queue.get(key)?.shift()
  }

  /**
   * @param key unique id
   * @returns all the entries and removes them from the queue
   */
  getAll(key: string) {
    return this.queue.get(key)?.splice(0)
  }
}
