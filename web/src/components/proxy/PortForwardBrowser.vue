<template>
  <Teleport to="body">
    <div v-if="visible" class="pf-browser">
      <!-- Toolbar -->
      <div class="pf-toolbar">
        <button class="pf-back-btn" @click="close" :title="t('nav.prevFile')">
          <ChevronLeft :size="18" />
        </button>
        <div class="pf-url-bar" ref="urlBarRef">
          <span class="pf-protocol" @click="toggleProtocol" :title="t('proxy.switchProtocol', { protocol: altProtocol })">{{ currentProtocol }}://</span>
          <span class="pf-host">localhost:{{ port }}</span>
          <input
            ref="pathInputRef"
            class="pf-path-input"
            v-model="currentPath"
            placeholder="/"
            @keydown.enter="navigate"
            spellcheck="false"
          />
        </div>
        <button class="pf-refresh-btn" @click="refresh" :title="t('nav.refresh')">
          <RotateCw :size="16" />
        </button>
      </div>

      <!-- iframe -->
      <iframe
        ref="iframeRef"
        class="pf-iframe"
        :src="iframeSrc"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        allow="clipboard-read; clipboard-write"
        @load="onIframeLoad"
      />

      <!-- Loading overlay -->
      <div v-if="loading" class="pf-loading">
        <Loader class="pf-spinner" :size="32" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ChevronLeft, RotateCw, Loader } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const port = ref(0)
const currentProtocol = ref('http')
const currentPath = ref('/')
const loading = ref(false)

const iframeRef = ref(null)
const pathInputRef = ref(null)
const urlBarRef = ref(null)

const altProtocol = computed(() => currentProtocol.value === 'http' ? 'https' : 'http')

const iframeSrc = computed(() =>
  `${currentProtocol.value}://localhost:${port.value}${currentPath.value || '/'}`
)

function open(targetPort, protocol = 'http', path = '/') {
  port.value = targetPort
  currentProtocol.value = protocol === 'https' ? 'https' : 'http'
  currentPath.value = path || '/'
  loading.value = true
  visible.value = true
  document.body.style.overflow = 'hidden'
}

function close() {
  visible.value = false
  document.body.style.overflow = ''
  nextTick(() => {
    if (iframeRef.value) {
      iframeRef.value.src = 'about:blank'
    }
  })
}

function toggleProtocol() {
  currentProtocol.value = altProtocol.value
  loading.value = true
}

function navigate() {
  let p = currentPath.value.trim()
  if (!p.startsWith('/')) p = '/' + p
  currentPath.value = p
  loading.value = true
  if (iframeRef.value) {
    iframeRef.value.src = iframeSrc.value
  }
  pathInputRef.value?.blur()
}

function refresh() {
  loading.value = true
  if (iframeRef.value) {
    iframeRef.value.src = iframeSrc.value
  }
}

function onIframeLoad() {
  loading.value = false
  try {
    const iframeWindow = iframeRef.value?.contentWindow
    if (iframeWindow && iframeWindow.location) {
      const actualPath = iframeWindow.location.pathname || '/'
      const search = iframeWindow.location.search || ''
      const hash = iframeWindow.location.hash || ''
      const fullPath = actualPath + search + hash
      if (fullPath !== currentPath.value) {
        currentPath.value = fullPath
      }
    }
  } catch {
    // Cross-origin iframe — can't read location
  }
}

defineExpose({ open, close })
</script>

<style scoped>
.pf-browser {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.pf-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  padding-top: calc(6px + env(safe-area-inset-top, 0));
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.pf-back-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.pf-back-btn:hover {
  background: var(--accent-color);
  color: #fff;
}

.pf-url-bar {
  flex: 1;
  min-width: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 8px;
  height: 30px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-family: monospace;
  /* Allow horizontal scroll for long URLs */
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  white-space: nowrap;
}

.pf-url-bar::-webkit-scrollbar {
  display: none;
}

.pf-protocol {
  color: var(--text-muted);
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.pf-protocol:hover {
  color: var(--accent-color);
}

.pf-host {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.pf-path-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-family: monospace;
  outline: none;
  padding: 0;
  margin: 0;
}

.pf-path-input::placeholder {
  color: var(--text-muted);
}

.pf-refresh-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.pf-refresh-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.pf-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}

.pf-loading {
  position: absolute;
  inset: 0;
  top: 44px; /* below toolbar */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  opacity: 0.8;
  pointer-events: none;
}

.pf-spinner {
  color: var(--accent-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
