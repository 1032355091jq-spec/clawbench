/**
 * Generic composable for SSE/WebSocket reconnection with exponential backoff.
 * Extracts the common reconnect logic shared across useTerminalSession,
 * useChatStream, and useFileWatch.
 */
export interface ReconnectOptions {
  maxAttempts?: number           // default 3
  baseDelay?: number             // default 2000 (ms)
  onReconnect: () => void        // callback to reconnect
  getFatalError?: () => boolean | null // return non-null = fatal, null = safe to reconnect
}

export function useReconnect(options: ReconnectOptions) {
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disabled = false

  function hasActiveAttempts(): boolean {
    return reconnectAttempts < (options.maxAttempts ?? 3)
  }

  function scheduleReconnect() {
    const delay = (options.baseDelay ?? 2000) * (reconnectAttempts + 1)
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      options.onReconnect()
    }, delay)
  }

  function reset() {
    reconnectAttempts = 0
    disabled = false
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function disable() {
    disabled = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function shouldReconnect(): boolean {
    if (disabled) return false
    if (options.getFatalError?.() !== null) return false
    return hasActiveAttempts()
  }

  return {
    scheduleReconnect,
    reset,
    disable,
    shouldReconnect,
    getAttempts: () => reconnectAttempts,
  }
}