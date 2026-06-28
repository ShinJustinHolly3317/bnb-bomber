import http from 'node:http'

import { WebSocketServer } from 'ws'

import { RoomManager } from './RoomManager.js'

const PORT = Number(process.env.PORT ?? 8787)
const rooms = new RoomManager()

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server })
wss.on('connection', (ws) => {
  rooms.handleConnection(ws)
})

server.listen(PORT, () => {
  console.log(`bnb game server listening on :${PORT}`)
})
