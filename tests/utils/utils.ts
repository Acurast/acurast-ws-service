import { WebSocket } from 'ws'
import { Proxy } from '../../src/proxy/proxy'
import { WorkerPool } from '../../src/worker/worker-pool'
import { forgeMessage } from '@acurast/transport-websocket'
import { hexTo } from '../../src/utils/bytes'

export function register(workerPoolMock: WorkerPool, proxy: Proxy, client: WebSocket, id: string) {
  // init request
  workerPoolMock.postMessage = jest.fn() // Mock the postMessage method
  proxy.onMessage(
    client,
    forgeMessage({
      version: 1,
      type: 'init',
      sender: Buffer.from(id),
      recipient: Buffer.from('00000000000000000000000000000000')
    })
  )
  ;(proxy as any).webSockets.set(id, client)
  // response
  ;(proxy as any).processorWorkerHandler({
    action: {
      sender: hexTo(id),
      type: 'register',
      message: {
        version: 1,
        type: 'payload',
        sender: hexTo(id),
        recipient: hexTo(id),
        payload: hexTo('test')
      }
    },
    senderId: id
  })
}
