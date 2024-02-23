import { proxyConfigReader } from '../proxy-reader'

export class TopicsFilter {
  private static topics = new Set(proxyConfigReader<string[]>('pubsub.ignore', []))

  static allow(topic: string): boolean {
    return !this.topics.has(topic)
  }
}
