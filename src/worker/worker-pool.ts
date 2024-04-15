import { WorkerType } from './worker-types'
import { Worker } from 'worker_threads'
import { cpus } from 'os'

export class WorkerPool {
  private readonly pool: Map<WorkerType, Worker[]> = new Map()

  constructor(request: Map<WorkerType, { handler: (...args: any) => void; amount: number }>) {
    this.init(request)
  }

  private init(request: Map<WorkerType, { handler: (...args: any) => void; amount: number }>) {
    const totalRequested = Array.from(request.values()).reduce((total, el) => total + el.amount, 0)

    if (totalRequested > cpus().length) {
      throw new Error('Requested number of workers exceeds number of available threads.')
    }

    for (const [key, data] of request.entries()) {
      if (!this.pool.has(key)) {
        this.pool.set(key, [])
      }

      const ref = this.pool.get(key)!

      for (let i = 0; i < data.amount; i++) {
        const worker = this.generateWorker(key)

        worker.on('message', data.handler)

        ref.push(worker)
      }
    }
  }

  private generateWorker(type: WorkerType) {
    switch (type) {
      case WorkerType.LISTENER:
        return new Worker('./dist/worker/scripts/listener-worker')
      case WorkerType.PROCESSOR:
        return new Worker('./dist/worker/scripts/processor-worker')
      default:
        throw Error('Invalid type.')
    }
  }

  postMessage(type: WorkerType, data: any) {
    const workers = this.pool.get(type)

    if (!workers || !workers.length) {
      throw new Error('No pool available for specified type')
    }

    // trivial load balancer using FIFO order
    const worker = workers.pop()!
    worker.postMessage(data)
    workers.push(worker)
  }

  kill() {
    for (const wokers of this.pool.values()) {
      wokers.forEach((worker) => worker.terminate())
    }
  }
}
