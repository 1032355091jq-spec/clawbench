import { describe, expect, it } from 'vitest'
import { resolveTerminalCwd, shouldPromptForTerminalReopen } from '@/components/terminal/terminalCwd'

describe('terminal cwd resolution', () => {
  it('uses the opened file directory before the file manager directory', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'web/src/App.vue', currentDir: 'docs' })).toBe('web/src')
  })

  it('uses project root for files at project root', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'README.md', currentDir: 'docs' })).toBe('')
  })

  it('falls back to the current file manager directory when no file is open', () => {
    expect(resolveTerminalCwd({ currentFilePath: '', currentDir: 'internal/terminal' })).toBe('internal/terminal')
  })

  it('uses an explicit requested cwd for open-terminal-here actions', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'README.md', currentDir: '', requestedCwd: 'cmd/server' })).toBe('cmd/server')
  })

  it('prompts before reopening when an existing terminal runs in a different directory', () => {
    expect(shouldPromptForTerminalReopen('/repo/internal/terminal', '/repo/web/src')).toBe(true)
  })

  it('does not prompt when the target directory matches the existing terminal directory', () => {
    expect(shouldPromptForTerminalReopen('/repo/web/src/', '/repo/web/src')).toBe(false)
  })
})
