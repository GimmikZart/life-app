import WebSocket from 'ws'

export default defineNitroPlugin(() => {
  if (!globalThis.WebSocket) {
    globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
  }
})
