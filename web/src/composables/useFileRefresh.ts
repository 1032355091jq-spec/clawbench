/**
 * useFileRefresh — shared logic for refreshing the currently viewed file
 * while preserving scroll position.
 *
 * Used by three independent refresh triggers:
 * 1. Manual refresh (refresh button in FileHeader / FileManager)
 * 2. fsnotify auto-refresh (useFileWatch SSE file_change event)
 * 3. Chat-driven refresh (ChatPanel onFileModified callback)
 *
 * All three should behave identically: reload the file content, keep the
 * user at the same relative scroll position.
 */
import { store } from '@/stores/app.ts'

/**
 * Find the scrollable container for the currently viewed file.
 * Markdown files scroll inside `.markdown-body`; code files scroll inside `.raw-content-pre`.
 */
function getScrollContainer(): HTMLElement | null {
  return (document.querySelector('.markdown-body') || document.querySelector('.raw-content-pre')) as HTMLElement | null
}

/**
 * Calculate the current scroll position as a ratio (0–1) of the total
 * scrollable area. Ratio-based restoration is more robust than pixel-based
 * when content height changes (e.g., AI adds/removes content, Mermaid
 * diagrams render asynchronously).
 */
function getScrollRatio(el: HTMLElement | null): number {
  if (!el) return 0
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0) return 0
  return el.scrollTop / maxScroll
}

/**
 * Restore scroll position from a previously saved ratio.
 * Uses requestAnimationFrame polling to wait for content to be rendered
 * and stable (including async Mermaid diagrams), then applies the ratio.
 * Falls back after 3 seconds to avoid infinite loops.
 */
function restoreScrollRatio(ratio: number): void {
  if (ratio <= 0) return
  const startTime = Date.now()
  const MAX_WAIT = 3000

  function tryRestore() {
    const el = getScrollContainer()
    if (!el) {
      if (Date.now() - startTime < MAX_WAIT) requestAnimationFrame(tryRestore)
      return
    }
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) {
      // Content not yet rendered (scrollHeight not expanded)
      if (Date.now() - startTime < MAX_WAIT) requestAnimationFrame(tryRestore)
      return
    }
    el.scrollTop = ratio * maxScroll
  }
  // Start after 2 frames to let Vue render the new content
  requestAnimationFrame(() => requestAnimationFrame(tryRestore))
}

/**
 * Refresh the currently viewed file content while preserving scroll position.
 *
 * @param options.loadDir - Also refresh the directory listing (default: false)
 * @param options.clearOnError - If the file fails to load, clear currentFile (default: false)
 */
export async function refreshCurrentFile(options: {
  loadDir?: boolean
  clearOnError?: boolean
} = {}): Promise<void> {
  const { loadDir = false, clearOnError = false } = options
  const currentFilePath = store.state.currentFile?.path
  const currentFile = store.state.currentFile

  // Save scroll position as ratio before refresh
  const scrollEl = getScrollContainer()
  const scrollRatio = getScrollRatio(scrollEl)

  // Refresh directory listing if requested
  if (loadDir && store.state.currentDir !== undefined) {
    store.loadFiles(store.state.currentDir)
  }

  // Refresh file content
  if (currentFilePath) {
    await store.selectFile(
      currentFilePath,
      currentFile?.isImage,
      currentFile?.isAudio,
      false, // addToHistory=false — this is a refresh, not navigation
    )

    // Clear file on error if requested
    if (clearOnError && store.state.currentFile?.error) {
      store.state.currentFile = null
      return
    }

    // Restore scroll position
    restoreScrollRatio(scrollRatio)
  }
}

export { getScrollContainer, getScrollRatio, restoreScrollRatio }
