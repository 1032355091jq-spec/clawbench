import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReconnect } from './useReconnect'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface TerminalStatus {
  running: boolean
  cwd: string
}

// Error codes that should NOT trigger automatic reconnection
const NO_RECONNECT_CODES = new Set([
  'terminal_disabled',
  'shell_start_failed',
  'session_limit',
])

// Custom WebSocket close codes from the backend (4000-4999 per RFC 6455)
// When the server kicks an existing client because a new one connected,
// it uses this code so the old client knows not to auto-reconnect.
const WS_CLOSE_REPLACED = 4001

export function useTerminalSession(getWsUrl: () => string) {
  const { t } = useI18n()
  const connectionState: Ref<ConnectionState> = ref('disconnected')
  const errorMessage = ref('')
  const errorCode = ref('')
  const currentCwd = ref('')
  const sessionId = ref('')
  const ws: Ref<WebSocket | null> = ref(null)
  // Track whether the current error is fatal (should not auto-reconnect)
  let fatalError = false

  const reconnect = useReconnect({
    onReconnect: () => connect().catch(() => { /* onclose handles retry logic */ }),
    getFatalError: () => fatalError ? true : null,
  })

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      connectionState.value = 'connecting'
      errorMessage.value = ''
      errorCode.value = ''
      fatalError = false

      // Build URL with session ID for reconnect (to reattach to existing PTY)
      let url = getWsUrl()
      if (sessionId.value) {
        const sep = url.includes('?') ? '&' : '?'
        url += `${sep}session=${encodeURIComponent(sessionId.value)}`
      }
      const socket = new WebSocket(url)

      socket.onopen = () => {
        connectionState.value = 'connected'
        reconnect.reset()
        ws.value = socket
        resolve()
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          handleMessage(msg)
        } catch {
          console.warn('terminal: invalid message', event.data)
        }
      }

      socket.onclose = (event) => {
        ws.value = null

        // If already in error state (from onerror or fatal error message),
        // don't override — keep the error visible
        if (connectionState.value === 'error') {
          return
        }

        // Close code 4001 = replaced by a new client (e.g. another browser tab
        // or mobile app connected to the same terminal session).  The session
        // is still alive — just owned by a different client now — so we must
        // NOT auto-reconnect, otherwise we'd kick the new client and start an
        // infinite kick-reconnect loop.
        if (event.code === WS_CLOSE_REPLACED) {
          connectionState.value = 'disconnected'
          reconnect.disable()
          return
        }

        if (connectionState.value === 'connected') {
          // Unexpected disconnect after successful connection — try reconnecting
          connectionState.value = 'disconnected'
          tryReconnect()
        } else {
          // If intentionally disconnected (reconnect exhausted), don't set error
          if (!reconnect.shouldReconnect()) {
            connectionState.value = 'disconnected'
            return
          }
          // Failed during connecting/reconnecting
          // WebSocket close code 1006 = abnormal closure (server rejected upgrade)
          if (event.code === 1006 && !fatalError) {
            // Likely a server-side error (PTY start failure, etc.)
            errorMessage.value = t('terminal.shellStartFailed')
            errorCode.value = 'shell_start_failed'
            connectionState.value = 'error'
            fatalError = true
          } else {
            connectionState.value = 'disconnected'
          }
        }
      }

      socket.onerror = () => {
        ws.value = null
        // Don't set error state here — onclose will fire next and handle it
        // Just remember this was a connection failure
        if (connectionState.value !== 'error') {
          errorMessage.value = t('terminal.websocketFailed')
          connectionState.value = 'error'
        }
        reject(new Error(errorMessage.value))
      }
    })
  }

  function disconnect() {
    reconnect.reset()
    fatalError = false
    sessionId.value = '' // intentional close = next connect creates new session
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    connectionState.value = 'disconnected'
  }

  // reset clears all state for a fresh connect (used by rebuild session)
  function reset() {
    reconnect.reset()
    fatalError = false
    errorMessage.value = ''
    errorCode.value = ''
    sessionId.value = '' // rebuild = new session
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    connectionState.value = 'disconnected'
  }

  function tryReconnect() {
    if (!reconnect.shouldReconnect()) {
      connectionState.value = 'error'
      errorMessage.value = errorMessage.value || t('terminal.websocketFailed')
      return
    }
    connectionState.value = 'reconnecting'
    reconnect.scheduleReconnect()
  }

  // Message handler callbacks — set by TerminalPanel
  let onOutput: ((data: string) => void) | null = null
  let onReplay: ((data: string) => void) | null = null
  let onStatus: ((status: TerminalStatus) => void) | null = null
  let onExit: ((code: number) => void) | null = null
  let onError: ((message: string, code: string) => void) | null = null

  function setCallbacks(callbacks: {
    onOutput?: (data: string) => void
    onReplay?: (data: string) => void
    onStatus?: (status: TerminalStatus) => void
    onExit?: (code: number) => void
    onError?: (message: string, code: string) => void
  }) {
    onOutput = callbacks.onOutput ?? null
    onReplay = callbacks.onReplay ?? null
    onStatus = callbacks.onStatus ?? null
    onExit = callbacks.onExit ?? null
    onError = callbacks.onError ?? null
  }

  function handleMessage(msg: { type: string; sessionId?: string; data?: string; cwd?: string; running?: boolean; code?: number; message?: string; errcode?: string }) {
    switch (msg.type) {
      case 'output':
        onOutput?.(msg.data ?? '')
        break
      case 'replay':
        onReplay?.(msg.data ?? '')
        break
      case 'status':
        // Store session ID for reconnect
        if (msg.sessionId) {
          sessionId.value = msg.sessionId
        }
        currentCwd.value = msg.cwd ?? ''
        onStatus?.({ running: msg.running ?? true, cwd: msg.cwd ?? '' })
        break
      case 'exit':
        sessionId.value = '' // session is gone
        connectionState.value = 'disconnected'
        onExit?.(msg.code ?? 0)
        break
      case 'error':
        errorMessage.value = msg.message ?? ''
        errorCode.value = msg.errcode ?? ''
        connectionState.value = 'error'
        // Fatal errors should not auto-reconnect
        if (msg.errcode && NO_RECONNECT_CODES.has(msg.errcode)) {
          fatalError = true
        }
        onError?.(msg.message ?? '', msg.errcode ?? '')
        break
    }
  }

  function sendInput(data: string) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'input', data }))
    }
  }

  function sendResize(cols: number, rows: number) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  }

  function sendClose() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'close' }))
    }
    disconnect()
  }

  return {
    connectionState,
    errorMessage,
    errorCode,
    currentCwd,
    sessionId,
    connect,
    disconnect,
    reset,
    setCallbacks,
    sendInput,
    sendResize,
    sendClose,
  }
}
