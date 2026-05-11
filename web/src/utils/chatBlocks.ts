/**
 * Pure functions extracted from useChatRender composable.
 * These have no Vue reactivity dependencies and can be tested in isolation.
 */
import { baseName } from '@/utils/path.ts'
import { gt } from '@/composables/useLocale'

/**
 * Parse assistant content string into structured blocks.
 * Handles JSON blocks, tool_use deduplication, and fallback to text.
 */
export function parseAssistantContent(content: string) {
  if (!content) return { blocks: [], metadata: null }
  try {
    const parsed = JSON.parse(content)
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      const mapped = parsed.blocks.map(b => {
        if (b.type === 'tool_use') {
          if (b.done === undefined || b.done === false) b.done = true
          if (!b.output && b.input && b.input.output) {
            b.output = b.input.output
            delete b.input.output
          }
        }
        return b
      })
      const result: any[] = []
      const toolIndex = new Map()
      for (const b of mapped) {
        if (b.type === 'tool_use' && b.id) {
          const prevIdx = toolIndex.get(b.id)
          if (prevIdx !== undefined) {
            const prev = result[prevIdx]
            const prevEmpty = !prev.input || Object.keys(prev.input).length === 0
            const currEmpty = !b.input || Object.keys(b.input).length === 0
            if (currEmpty && !prevEmpty) continue
            if (!currEmpty && prevEmpty) {
              prev.input = b.input
              prev.done = b.done
              prev.name = b.name || prev.name
              if (b.output) prev.output = b.output
              if (b.status) prev.status = b.status
              continue
            }
            if (b.done) prev.done = true
            if (!currEmpty) prev.input = b.input
            if (b.output) prev.output = b.output
            if (b.status) prev.status = b.status
            continue
          }
          toolIndex.set(b.id, result.length)
        }
        result.push(b)
      }
      return {
        blocks: result,
        metadata: parsed.metadata || null,
        cancelled: parsed.cancelled || false
      }
    }
  } catch {}
  return { blocks: [{ type: 'text', text: content }], metadata: null }
}

/**
 * Generate a human-readable summary for a tool call block.
 * Uses a priority chain: description > file_path > command > pattern > query > url > skill > prompt > path > src_path+dst_path > firstVal
 */
export function toolCallSummary(block: { input?: any; name?: string }): string {
  if (!block.input) return ''
  const name = (block.name || '').toLowerCase()
  if (name === 'askuserquestion' && Array.isArray(block.input.questions) && block.input.questions.length > 0) {
    const q = block.input.questions[0]
    const header = q.header || ''
    const question = q.question || ''
    if (header) return header
    if (question) return question.length > 60 ? question.slice(0, 57) + '...' : question
  }
  if (block.input.description) return block.input.description
  const obj = block.input
  if (obj.file_path) return baseName(obj.file_path)
  if (obj.command) return obj.command.length > 60 ? obj.command.slice(0, 57) + '...' : obj.command
  if (obj.pattern) return obj.pattern.length > 60 ? obj.pattern.slice(0, 57) + '...' : obj.pattern
  if (obj.query) return obj.query.length > 60 ? obj.query.slice(0, 57) + '...' : obj.query
  if (obj.url) return obj.url.length > 60 ? obj.url.slice(0, 57) + '...' : obj.url
  if (obj.skill) return obj.skill
  if (obj.prompt && name === 'agent') return obj.prompt.length > 60 ? obj.prompt.slice(0, 57) + '...' : obj.prompt
  if (obj.path) return baseName(obj.path)
  if (obj.src_path && obj.dst_path) return `${baseName(obj.src_path)} → ${baseName(obj.dst_path)}`
  const firstVal = Object.values(obj)[0]
  if (typeof firstVal === 'string' && firstVal.length < 80) return firstVal
  return ''
}

/**
 * Check if content contains markdown image syntax.
 */
export function hasImagesInContent(content: string | null | undefined): boolean {
  return !!content && content.includes('![')
}

/**
 * Format a timestamp into a relative time string (e.g., "5 min ago", "2d ago").
 * Falls back to "M/D HH:mm" for dates older than 7 days.
 */
export function formatMessageTime(createdAt: string): string {
  const date = new Date(createdAt)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return gt('time.justNow')
  if (diffMins < 60) return gt('time.minutesAgo', { count: diffMins })

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return gt('time.hoursAgo', { count: diffHours })

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return gt('time.daysAgo', { count: diffDays })

  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

/**
 * Format a timestamp into a detailed "YYYY-MM-DD HH:mm:ss" string.
 */
export function formatDetailTime(createdAt: string): string {
  const date = new Date(createdAt)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const second = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * Convert a cron expression into a human-readable description.
 */
export function humanizeCron(expr: string): string {
  const parts = expr.split(' ')
  if (parts.length !== 5) return expr
  const [min, hour, day, month, weekday] = parts
  if (min.startsWith('*/') && hour === '*') return gt('cron.everyMinutes', { count: min.slice(2) })
  if (hour.startsWith('*/') && min === '0') return gt('cron.everyHours', { count: hour.slice(2) })
  if (min === '0' && !hour.includes('/') && day === '*' && month === '*' && weekday === '*') return gt('cron.daily', { time: `${hour}:00` })
  if (min === '0' && weekday === '1-5') return gt('cron.weekdays', { time: `${hour}:00` })
  return expr
}

/**
 * Get a human-readable label for a task repeat mode.
 */
export function repeatLabel(mode: string, maxRuns?: number): string {
  if (mode === 'once') return gt('task.repeat.onceExecute')
  if (mode === 'limited') return gt('task.repeat.timesThenStop', { count: maxRuns })
  return gt('task.repeat.unlimitedTimes')
}

/**
 * Truncate a string to a maximum number of Unicode codepoints, appending "..." if truncated.
 * Returns empty string for null/undefined input.
 */
export function truncate(str: string | null | undefined, len: number): string {
  if (!str) return ''
  const runes = [...str]
  return runes.length > len ? runes.slice(0, len).join('') + '...' : str
}
