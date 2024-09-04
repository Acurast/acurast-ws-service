import { WebSocket } from 'ws'

export const isWSConnectionOpen = (ws?: WebSocket): boolean => !!ws && ws.readyState === 1
