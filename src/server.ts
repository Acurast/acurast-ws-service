import express, { type Express, type Request, type Response } from 'express'
import { type IncomingMessage } from 'http'
import { type Duplex } from 'stream'
import WebSocket from 'ws'

import { Proxy } from './proxy/proxy'
import { Logger } from './utils/Logger'
import { initSentry } from './init-sentry'

const app: Express = express()
const proxy: Proxy = new Proxy()
const wss = new WebSocket.Server({ noServer: true, clientTracking: true })

initSentry(app)

wss.on('connection', (ws: WebSocket) => {
  ws.binaryType = 'nodebuffer'

  ws.on('message', (data: WebSocket.RawData) => {
    Logger.debug('server', 'ws.message', 'begin')
    const bytes: Buffer | undefined = Buffer.isBuffer(data)
      ? data
      : data instanceof ArrayBuffer
        ? Buffer.from(data)
        : undefined

    if (bytes !== undefined) {
      proxy.onMessage(ws, bytes)
    }

    Logger.debug('server', 'ws.message', 'end')
  })

  ws.on('close', (code: number, reason: Buffer) => {
    Logger.debug('server', 'ws.close', 'begin')
    proxy.reset(code, reason.toString('utf-8'), ws)
    Logger.debug('server', 'ws.close', 'end')
  })

  ws.on('error', (error: Error) => {
    console.error(error)
  })
})

wss.on('error', (error: Error) => {
  console.error(error)
})

wss.on('close', () => {
  Logger.debug('server', 'close', 'begin')
  proxy.destroy()
  Logger.debug('server', 'close', 'end')
})

app.get('/*', (_req: Request, res: Response) => {
  res.set('access-control-allow-origin', '*')
  res.send('Hello!')
})

const server = app.listen(9001, () => {
  Logger.log('Acurast WebSocket Proxy listening on port 9001')
})

server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
  wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    wss.emit('connection', ws, request)
  })
})
