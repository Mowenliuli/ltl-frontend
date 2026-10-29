/**
 * WebSocket 连接管理：自动重连、事件订阅、心跳。
 *
 * 用法：
 *   import { wsClient } from './ws/client'
 *   wsClient.connect()
 *   const off = wsClient.on('message', (msg) => { ... })
 *   wsClient.send({ action: 'send', conv_id, type: 'text', content })
 */
import { WS_BASE } from '../config'
import { getToken } from '../api/client'

class WSClient {
  constructor() {
    this.ws = null
    this.handlers = new Map() // event -> Set<fn>
    this.retryDelay = 1000
    this.maxRetry = 15000
    this.pingTimer = null
    this.reconnectTimer = null
    this.closedByUser = false
  }

  connect() {
    const token = getToken()
    if (!token || (this.ws && this.ws.readyState <= WebSocket.OPEN)) return
    if (this.closedByUser) return // disconnect() 之后必须等显式重开
    clearTimeout(this.reconnectTimer)

    const base = WS_BASE || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
    this.ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`)

    this.ws.onopen = () => {
      this.closedByUser = false // 连接建立后重置，允许后续断线自动重连
      this.retryDelay = 1000
      this._emit('open')
      this.pingTimer = setInterval(() => this.send({ action: 'ping' }), 25000)
    }

    this.ws.onmessage = (e) => {
      let data
      try { data = JSON.parse(e.data) } catch { return }
      if (data.event) this._emit(data.event, data.data ?? data)
    }

    this.ws.onclose = (ev) => {
      clearInterval(this.pingTimer)
      // 便于排查：把 code/reason 打到 console
      console.debug('[ws] closed', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean })
      this._emit('close')
      if (!this.closedByUser && getToken()) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.retryDelay)
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetry)
      }
    }

    this.ws.onerror = () => this.ws?.close()
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
      return true
    }
    return false
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event).add(fn)
    return () => this.handlers.get(event)?.delete(fn)
  }

  _emit(event, data) {
    this.handlers.get(event)?.forEach((fn) => fn(data))
  }

  disconnect() {
    this.closedByUser = true
    clearInterval(this.pingTimer)
    clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  /** 显式重新开启（如登出后再登录）。 */
  reopen() {
    this.closedByUser = false
    this.connect()
  }
}

export const wsClient = new WSClient()
