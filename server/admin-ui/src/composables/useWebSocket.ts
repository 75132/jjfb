import { ref, readonly, onUnmounted } from 'vue'
import type { WsMessage } from '@/types/admin'

type MessageHandler = (data: WsMessage) => void

const connected = ref(false)
const wsRef = ref<WebSocket | null>(null)
const handlers = new Map<string, Set<MessageHandler>>()
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const MAX_RECONNECT = 10
const RECONNECT_DELAY = 3000

function getWsUrl(): string {
  const host = location.hostname || 'localhost'
  return `ws://${host}:8001`
}

function dispatch(data: WsMessage) {
  if (data.type === 'ping') {
    send({ type: 'pong' })
    return
  }
  const runHandlers = (set: Set<MessageHandler> | undefined) => {
    if (!set) return
    for (const h of set) {
      try {
        h(data)
      } catch (e) {
        console.error('[WS] handler error for', data.type, e)
      }
    }
  }
  runHandlers(handlers.get(data.type))
  runHandlers(handlers.get('*'))
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) return
  reconnectAttempts++
  reconnectTimer = setTimeout(() => {
    connect()
  }, RECONNECT_DELAY)
}

export function connect() {
  if (wsRef.value?.readyState === WebSocket.OPEN) return

  try {
    const ws = new WebSocket(getWsUrl())
    wsRef.value = ws

    ws.onopen = () => {
      connected.value = true
      reconnectAttempts = 0
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    ws.onclose = () => {
      connected.value = false
      attemptReconnect()
    }

    ws.onerror = () => {
      connected.value = false
    }

    ws.onmessage = (event) => {
      try {
        dispatch(JSON.parse(event.data) as WsMessage)
      } catch (e) {
        console.error('WS parse error', e)
      }
    }
  } catch (e) {
    console.error('WS connect error', e)
    connected.value = false
    attemptReconnect()
  }
}

export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = MAX_RECONNECT
  wsRef.value?.close()
  wsRef.value = null
  connected.value = false
}

export function send(msg: Record<string, unknown>): boolean {
  if (!wsRef.value || wsRef.value.readyState !== WebSocket.OPEN) {
    console.warn('WS not connected', msg)
    return false
  }
  try {
    wsRef.value.send(JSON.stringify(msg))
    return true
  } catch (e) {
    console.error('WS send error', e)
    return false
  }
}

export function sendAdmin(type: string, payload: Record<string, unknown> = {}): boolean {
  const adminToken = localStorage.getItem('admin_token') || 'dev_admin_token'
  return send({ type, admin_token: adminToken, ...payload })
}

export function onMessage(type: string, handler: MessageHandler) {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(handler)
  return () => {
    handlers.get(type)?.delete(handler)
  }
}

export { connected }

export function useWebSocket() {
  onUnmounted(() => {
    // handlers cleaned per-component via onMessage return
  })
  return {
    connected: readonly(connected),
    connect,
    disconnect,
    send,
    sendAdmin,
    onMessage,
  }
}
