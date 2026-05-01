// Custom rendering for tool_use block details in chat messages

import { hljs } from './globals.ts'
import { escapeHtml } from './html.ts'
import { detectLang, highlightLine } from './diff.ts'
import { resolveFilePath } from '@/composables/useFilePathAnnotation.ts'
import { store } from '@/stores/app.ts'

/**
 * Render Edit tool input as a diff view.
 * Shows old_string lines in red, new_string lines in green.
 * No line numbers, no +/- prefix — color-only distinction.
 * File path is clickable to open the file.
 */
function renderEditDiff(input: Record<string, any>): string {
  const filePath = input.file_path || ''
  const oldStr = input.old_string || ''
  const newStr = input.new_string || ''
  const replaceAll = input.replace_all

  // Resolve file path for click-to-open
  const projectRoot = store.state.projectRoot || ''
  const resolvedPath = resolveFilePath(filePath, projectRoot)
  const displayPath = resolvedPath || filePath.replace(/^\.\//, '')

  // Detect language for syntax highlighting
  const lang = detectLang(filePath)

  // Build header
  let header = '<div class="edit-diff-header">'
  if (resolvedPath) {
    header += `<span class="edit-diff-file chat-file-open-btn" data-file-path="${escapeHtml(resolvedPath)}" title="打开文件">${escapeHtml(displayPath)}</span>`
  } else {
    header += `<span class="edit-diff-file">${escapeHtml(displayPath)}</span>`
  }
  if (replaceAll) {
    header += '<span class="edit-diff-replace-all" title="Replace all occurrences">replaceAll</span>'
  }
  header += '</div>'

  // Build diff body
  let body = '<div class="edit-diff-body">'

  // Old lines (red)
  if (oldStr) {
    const oldLines = oldStr.split('\n')
    for (const line of oldLines) {
      body += `<div class="edit-diff-del">${highlightLine(line, lang)}</div>`
    }
  }

  // New lines (green)
  if (newStr) {
    const newLines = newStr.split('\n')
    for (const line of newLines) {
      body += `<div class="edit-diff-add">${highlightLine(line, lang)}</div>`
    }
  }

  body += '</div>'

  return `<div class="edit-diff-view">${header}${body}</div>`
}

/**
 * Render Bash tool input as a terminal-style view.
 * Shows description (if any) and command with $ prefix.
 */
function renderBashTerminal(input: Record<string, any>): string {
  const command = input.command || ''
  const description = input.description || ''

  let html = '<div class="bash-terminal-view">'

  if (description) {
    html += `<div class="bash-terminal-desc">${escapeHtml(description)}</div>`
  }

  html += '<div class="bash-terminal-body">'
  html += '<span class="bash-prompt">$</span>'

  // Highlight command as bash
  if (command) {
    try {
      html += hljs.highlight(command, { language: 'bash', ignoreIllegals: true }).value
    } catch {
      html += escapeHtml(command)
    }
  }

  html += '</div></div>'

  return html
}

/**
 * Format tool_use input for display in the expanded tool detail area.
 * Dispatches to specialized renderers for Edit and Bash tools,
 * falls back to JSON rendering for all other tool types.
 */
export function formatToolInput(input: any, toolName?: string): string {
  if (toolName && input && typeof input === 'object') {
    const lower = toolName.toLowerCase()
    if (lower === 'edit') return renderEditDiff(input)
    if (lower === 'bash') return renderBashTerminal(input)
  }

  // Default: JSON rendering
  if (!input || (typeof input === 'object' && Object.keys(input).length === 0)) {
    try {
      return hljs.highlight('{}', { language: 'json' }).value
    } catch {
      return '{}'
    }
  }
  try {
    const json = JSON.stringify(input, null, 2)
    return hljs.highlight(json, { language: 'json' }).value
  } catch {
    return JSON.stringify(input, null, 2)
  }
}
