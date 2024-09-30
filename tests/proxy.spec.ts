import { Proxy } from '../src/proxy/proxy'
import { forgeMessage, parseMessage, PayloadMessage } from '@acurast/transport-websocket'
import { WebSocket } from 'ws'
import { WorkerPool } from '../src/worker/worker-pool'
import { hexTo } from '../src/utils/bytes'
import { register } from './utils/utils'
import { MessageScheduler } from '../src/scheduler/message-scheduler'

jest.mock('../src/worker/worker-pool') // Mock WorkerPool class
jest.mock('node-cron')
jest.mock('ws', () => {
  return {
    WebSocket: jest.fn().mockImplementation(() => {
      return {
        close: jest.fn(),
        send: jest.fn(),
        isPaused: false,
        readyState: 1
      }
    })
  }
})
jest.useFakeTimers()

describe('Proxy', () => {
  let proxy: any
  let workerPoolMock: jest.Mocked<WorkerPool>

  beforeEach(() => {
    // Create an instance of the mock WorkerPool
    workerPoolMock = new WorkerPool(new Map()) as jest.Mocked<WorkerPool>

    // Mock WorkerPool constructor to return the mock instance
    ;(WorkerPool as jest.Mock).mockImplementation(() => workerPoolMock)

    // Create an instance of AbstractProxy
    proxy = new Proxy() // Assuming this is concrete for the test

    // Override the protected pool property with the mocked WorkerPool
    proxy.pool = workerPoolMock

    // flush scheduler

    Array.from((MessageScheduler.instance as any).queue.keys()).forEach((key: any) =>
      MessageScheduler.instance.getAll(key)
    )
  })

  test('the client should register', (done) => {
    const client: any = new WebSocket('ws://localhost:1234')

    client.send = (message: any) => {
      expect(message).toBeTruthy()
      done()
    }

    register(workerPoolMock, proxy, client, 'abcd')

    expect(proxy.webSockets.size).toBe(1)
    expect(proxy.webSockets.get('abcd')).toBeTruthy()
  })

  test('the client should disconnect', () => {
    const client = new WebSocket('ws://localhost:1234')

    register(workerPoolMock, proxy, client, 'abcd')

    expect(proxy.webSockets.size).toBe(1)
    expect(proxy.webSockets.get('abcd')).toBeTruthy()

    proxy.reset(1000, 'test', client)

    expect(proxy.webSockets.size).toBe(0)
    expect(proxy.webSockets.get('abcd')).toBeFalsy()
  })

  test('client1 should send a message to client2 over the same instance', (done) => {
    const client1 = new WebSocket('ws://localhost:1234')
    const client2: any = new WebSocket('ws://localhost:1234')

    // I have to use real ids because of convertion issues
    register(workerPoolMock, proxy, client1, 'c0dd3ccd019742c235f75279e2160ae0')
    register(workerPoolMock, proxy, client2, '5cdcbf1891187fe7e525a62890aade6e')

    expect(proxy.webSockets.size).toBe(2)
    expect(proxy.webSockets.get('c0dd3ccd019742c235f75279e2160ae0')).toBeTruthy()
    expect(proxy.webSockets.get('5cdcbf1891187fe7e525a62890aade6e')).toBeTruthy()
    client2.send = (message: any) => {
      const msg = parseMessage(message) as PayloadMessage
      if (!msg) {
        throw new Error('The received message is undefined.')
      }

      const sender = Buffer.from(msg.sender).toString('hex')
      const payload = Buffer.from(msg.payload).toString('hex')

      if (
        sender === 'c0dd3ccd019742c235f75279e2160ae0' &&
        payload === 'e357831d648067c6b0cc75589796ee1c'
      ) {
        done()
      }
    }
    proxy.processorWorkerHandler({
      action: {
        sender: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
        type: 'send',
        message: {
          version: 1,
          type: 'payload',
          sender: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
          recipient: hexTo('5cdcbf1891187fe7e525a62890aade6e'),
          payload: hexTo('e357831d648067c6b0cc75589796ee1c')
        }
      },
      senderId: 'c0dd3ccd019742c235f75279e2160ae0'
    })
  })

  test('client1 should send a message to client2 over libp2p', () => {
    const client = new WebSocket('ws://localhost:1234')

    register(workerPoolMock, proxy, client, 'c0dd3ccd019742c235f75279e2160ae0')

    expect(proxy.webSockets.size).toBe(1)
    expect(proxy.webSockets.get('c0dd3ccd019742c235f75279e2160ae0')).toBeTruthy()
    proxy.processorWorkerHandler({
      action: {
        sender: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
        type: 'send',
        message: {
          version: 1,
          type: 'payload',
          sender: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
          recipient: hexTo('5cdcbf1891187fe7e525a62890aade6e'),
          payload: hexTo('test')
        }
      },
      senderId: 'c0dd3ccd019742c235f75279e2160ae0'
    })

    // 1) Init
    // 2) Registration
    // 3) Registration - Network notification
    // 4) Actual message sent
    expect(workerPoolMock.postMessage).toHaveBeenCalledTimes(4)
  })

  test('client1 should get rate limited', () => {
    const client: any = new WebSocket('ws://localhost:1234')

    register(workerPoolMock, proxy, client, 'c0dd3ccd019742c235f75279e2160ae0')

    expect(proxy.webSockets.size).toBe(1)
    expect(proxy.webSockets.get('c0dd3ccd019742c235f75279e2160ae0')).toBeTruthy()

    const pauseMock = jest.fn(() => {
      client.isPaused = true
    })

    client.pause = pauseMock

    const message = forgeMessage({
      version: 1,
      type: 'payload',
      sender: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
      recipient: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
      payload: hexTo('c0dd3ccd019742c235f75279e2160ae0')
    })

    for (let i = 0; i <= 1000 && !client.isPaused; i++) {
      proxy.onMessage(client, message)
    }

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(client.isPaused).toBe(true)
  })

  // test: onNetworkMessage
  test('client1 should receive all messages after disconnecting', () => {
    const client1 = new WebSocket('ws://localhost:1234')
    const client2: any = new WebSocket('ws://localhost:1234')

    // I have to use real ids because of convertion issues
    register(workerPoolMock, proxy, client1, 'c0dd3ccd019742c235f75279e2160ae0')
    register(workerPoolMock, proxy, client2, '5cdcbf1891187fe7e525a62890aade6e')

    expect(proxy.webSockets.size).toBe(2)
    expect(proxy.webSockets.get('c0dd3ccd019742c235f75279e2160ae0')).toBeTruthy()
    expect(proxy.webSockets.get('5cdcbf1891187fe7e525a62890aade6e')).toBeTruthy()

    proxy.reset(1000, 'test', client1)

    expect(proxy.webSockets.size).toBe(1)
    expect(proxy.webSockets.get('c0dd3ccd019742c235f75279e2160ae0')).toBeFalsy()
    expect(proxy.webSockets.get('5cdcbf1891187fe7e525a62890aade6e')).toBeTruthy()

    const message = {
      version: 1,
      type: 'payload',
      sender: hexTo('5cdcbf1891187fe7e525a62890aade6e'),
      recipient: hexTo('c0dd3ccd019742c235f75279e2160ae0'),
      payload: hexTo('e357831d648067c6b0cc75589796ee1c')
    }

    let count = 0

    const postMessageMock = jest.fn((type: number, data: any) => {
      if (type !== 1) {
        return
      }

      const msg = parseMessage(data.message) as PayloadMessage

      if (!msg) {
        throw new Error('The received message was undefined')
      }

      const sender = Buffer.from(msg.sender).toString('hex')
      const payload = Buffer.from(msg.payload).toString('hex')

      if (
        sender === '5cdcbf1891187fe7e525a62890aade6e' &&
        payload === 'e357831d648067c6b0cc75589796ee1c'
      ) {
        count++
      }
    })

    ;(workerPoolMock as any).postMessage = postMessageMock

    for (let i = 0; i < 3; i++) {
      proxy.processorWorkerHandler({
        action: {
          sender: hexTo('5cdcbf1891187fe7e525a62890aade6e'),
          type: 'send',
          message
        },
        senderId: '5cdcbf1891187fe7e525a62890aade6e'
      })
    }

    register(workerPoolMock, proxy, client1, 'c0dd3ccd019742c235f75279e2160ae0')

    expect(postMessageMock).toHaveBeenCalled()
    expect(count).toBe(3)
  })
})
