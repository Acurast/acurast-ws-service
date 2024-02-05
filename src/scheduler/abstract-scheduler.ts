import { proxyConfigReader } from '../proxy-reader'
import { SchedulerElement } from './scheduler-element'

export abstract class AbstractScheduler<T extends SchedulerElement> {
  private queue: Map<string, T[]> = new Map()
  protected lastCleanup: number = 0
  protected limitSize: number = proxyConfigReader('scheduler.size', 20)
  protected timeframe: number = proxyConfigReader('scheduler.timeframe', 60000)

  /**
   * Removes all expired entries
   */
  cleanup() {
    const now = Date.now()

    if (now - this.lastCleanup < this.timeframe) {
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
   * Stores entries up to limitSize (inclusive)
   * @param list the list queued
   * @param entry a new entry to store
   */
  protected insert(list: T[], entry: T) {
    if (list.length === this.limitSize) {
      list.shift()
    }
    list.push(entry)
  }

  /**
   * Adds an entry to the queue
   * @param key unique id
   * @param entry a SchedulerElement object
   */
  add(key: string, entry: T) {
    if (this.queue.has(key)) {
      this.insert(this.queue.get(key)!, entry)
    } else {
      this.queue.set(key, [entry])
    }
  }

  /**
   * Appends an array of objects
   * @param key uinque id
   * @param entries a list of SchedulerElement objects
   */
  addAll(key: string, entries: T[]) {
    entries.forEach((entry) => this.add(key, entry))
  }

  /** Retrieves the bottom element of the queue
   * @param key unique id
   * @returns the bottom entry and removes it from the queue
   */
  getLast(key: string) {
    return this.queue.get(key)?.pop()
  }

  /** Retrieves the top element of the queue
   * @param key unique id
   * @returns the top entry and removes it from the queue
   */
  getFirst(key: string) {
    return this.queue.get(key)?.shift()
  }

  /** Retrieves all entries from the queue if key exists
   * @param key unique id
   * @returns all the entries and removes them from the queue
   */
  getAll(key: string) {
    return this.queue.get(key)?.splice(0)
  }
}
