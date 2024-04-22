import express, { type Express, type Request, type Response } from 'express'
import { type IncomingMessage } from 'http'
import { type Duplex } from 'stream'
import WebSocket, { AddressInfo } from 'ws'

import { Proxy } from './proxy/proxy'
import { Logger } from './utils/Logger'
import { initSentry } from './init-sentry'
import { validateConnection } from './utils/connection-validator'

const app: Express = express()
const proxy: Proxy = new Proxy()
const wss = new WebSocket.Server({ noServer: true, clientTracking: true })
const connectedClients = new Set<string>()

initSentry(app)

wss.on('connection', (ws: WebSocket, req) => {
  ws.binaryType = 'nodebuffer'

  const ip = req.socket.remoteAddress! // if undefined, the line below will return an error
  const error = validateConnection(connectedClients, ip)

  if (error) {
    ws.close(error.code, error.message)
    return
  }

  connectedClients.add(ip)
  Logger.log(`${ip} has connected.`)

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
    connectedClients.delete(ip)
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
  Logger.log(`Acurast WebSocket Proxy listening on port ${(server.address() as AddressInfo).port}`)
})

server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
  wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    wss.emit('connection', ws, request)
  })
})
