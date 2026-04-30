import { ref } from 'vue'
import { apiGet, apiPost, apiDelete } from '@/utils/api.ts'
import { useAppMode } from './useAppMode.ts'

interface ForwardedPort {
  port: number
  name: string
  protocol: string
  autoDetect: boolean
  active: boolean
}

interface DetectedPort {
  port: number
  protocol: string
}

export interface SSHInfo {
  enabled: boolean
  host: string
  port: number
  username: string
  fingerprint: string
  command: string
}

// Module-level shared state
const ports = ref<ForwardedPort[]>([])
const detectedPorts = ref<DetectedPort[]>([])
const loading = ref(false)
const sshInfo = ref<SSHInfo | null>(null)

/**
 * Manages port forwarding state: list of forwarded ports, CRUD operations,
 * auto-detection, and registration with Android native layer.
 */
export function usePortForward() {
  const { isAppMode } = useAppMode()

  async function loadPorts() {
    loading.value = true
    try {
      const data = await apiGet<{ ports: ForwardedPort[] }>('/api/proxy/ports')
      ports.value = data.ports || []
    } finally {
      loading.value = false
    }
  }

  async function registerPort(port: number, name?: string, protocol?: string) {
    await apiPost('/api/proxy/ports', { port, name: name || '', protocol: protocol || 'http' })
    // Register with Android native layer
    if (isAppMode.value) {
      ;(window as any).AndroidNative?.addForwardedPort(port)
    }
    await loadPorts()
  }

  async function unregisterPort(port: number) {
    await apiDelete(`/api/proxy/ports?port=${port}`)
    if (isAppMode.value) {
      ;(window as any).AndroidNative?.removeForwardedPort(port)
    }
    await loadPorts()
  }

  async function detectPorts() {
    const data = await apiGet<{ ports: DetectedPort[] }>('/api/proxy/detect')
    detectedPorts.value = data.ports || []
  }

  /** Sync all registered ports to Android native on initial load */
  async function syncToNative() {
    if (!isAppMode.value) return
    await loadPorts()
    for (const p of ports.value) {
      ;(window as any).AndroidNative?.addForwardedPort(p.port)
    }
  }

  /** Fetch SSH tunnel connection info from server */
  async function loadSSHInfo() {
    try {
      const data = await apiGet<SSHInfo>('/api/ssh/info')
      sshInfo.value = data
    } catch {
      sshInfo.value = null
    }
  }

  /** Open a forwarded port via localhost (SSH tunnel must be active) */
  function openPort(port: number, protocol?: string) {
    const scheme = protocol === 'https' ? 'https' : 'http'
    window.open(`${scheme}://localhost:${port}`, '_blank')
  }

  return {
    ports,
    detectedPorts,
    loading,
    isAppMode,
    sshInfo,
    loadPorts,
    registerPort,
    unregisterPort,
    detectPorts,
    syncToNative,
    loadSSHInfo,
    openPort,
  }
}
