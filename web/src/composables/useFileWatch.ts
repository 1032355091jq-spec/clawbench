import { watch, onUnmounted, type Ref } from 'vue'
import { store } from '@/stores/app.ts'
import { refreshCurrentFile } from '@/composables/useFileRefresh.ts'

interface UseFileWatchOptions {
  fileManagerOpen: Ref<boolean>
  currentDir: Ref<string>
  currentFile: Ref<{ path: string; isImage?: boolean; isAudio?: boolean; isVideo?: boolean } | null>
}

const MAX_RECONNECT = 3
const RECONNECT_DELAY = 2000

/**
 * useFileWatch connects to the backend file watch SSE endpoint,
 * listens for dir_change and file_change events, and auto-refreshes
 * the directory listing or file content accordingly.
 *
 * Only active when FileManager is open or a file is being viewed.
 */
export function useFileWatch(options: UseFileWatchOptions) {
  const { fileManagerOpen, currentDir, currentFile } = options

  let eventSource: EventSource | null = null
  let clientId: string | null = null
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let updating = false // guard against concurrent updateWatch calls

  function connect() {
    if (eventSource) return

    const params = new URLSearchParams()
    // Always pass dir (empty string = project root); backend resolves it
    params.set('dir', currentDir.value || '')
    if (currentFile.value?.path) params.set('file', currentFile.value.path)

    const url = `/api/file/watch?${params.toString()}`
    eventSource = new EventSource(url)

    eventSource.addEventListener('connected', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        clientId = data.clientId
        reconnectAttempts = 0
        updateWatch()
      } catch { /* ignore parse error */ }
    })

    eventSource.addEventListener('dir_change', () => {
      store.loadFiles(currentDir.value || '')
    })

    eventSource.addEventListener('file_change', () => {
      if (!currentFile.value?.path) return
      refreshCurrentFile()
    })

    eventSource.onerror = () => {
      disconnect()
      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
      }
      // After MAX_RECONNECT failures, stop trying — file watch is non-critical
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    clientId = null
  }

  async function updateWatch() {
    if (!clientId || updating) return
    updating = true
    try {
      await fetch('/api/file/watch/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          dir: currentDir.value || '',
          file: currentFile.value?.path || '',
        }),
      })
    } catch {
      // Update failed — will retry on next navigation
    } finally {
      updating = false
    }
  }

  function shouldWatch(): boolean {
    return fileManagerOpen.value || currentFile.value !== null
  }

  // Connect/disconnect based on activity
  watch(() => shouldWatch(), (active) => {
    if (active) {
      connect()
    } else {
      disconnect()
    }
  }, { immediate: true })

  // Update watched paths on navigation
  watch([currentDir, () => currentFile.value?.path], () => {
    if (eventSource && clientId) {
      updateWatch()
    }
  })

  onUnmounted(() => {
    disconnect()
  })

  return { connect, disconnect }
}
