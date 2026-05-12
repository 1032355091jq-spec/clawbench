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

describe('normalizeRelativePath (via resolveTerminalCwd)', () => {
  it('strips leading slashes from requested cwd', () => {
    expect(resolveTerminalCwd({ requestedCwd: '///cmd/server' })).toBe('cmd/server')
  })

  it('strips trailing slashes from requested cwd', () => {
    expect(resolveTerminalCwd({ requestedCwd: 'cmd/server///' })).toBe('cmd/server')
  })

  it('strips both leading and trailing slashes', () => {
    expect(resolveTerminalCwd({ requestedCwd: '///cmd/server///' })).toBe('cmd/server')
  })

  it('strips leading/trailing slashes from currentDir', () => {
    expect(resolveTerminalCwd({ currentDir: '///internal/terminal///' })).toBe('internal/terminal')
  })
})

describe('dirname (via resolveTerminalCwd)', () => {
  it('returns empty string for a root-level file with no slash', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'Makefile', currentDir: 'docs' })).toBe('')
  })

  it('returns parent directory for deeply nested file', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'a/b/c/d.txt', currentDir: '' })).toBe('a/b/c')
  })

  it('handles file path with leading slash', () => {
    expect(resolveTerminalCwd({ currentFilePath: '/web/src/App.vue', currentDir: '' })).toBe('web/src')
  })

  it('handles file path with trailing slash (treats last segment as directory)', () => {
    // dirname of "web/src/" → after normalization becomes "web/src", slash is at end → returns "web"
    expect(resolveTerminalCwd({ currentFilePath: 'web/src/', currentDir: '' })).toBe('web')
  })
})

describe('resolveTerminalCwd edge cases', () => {
  it('returns empty string when all inputs are empty or null', () => {
    expect(resolveTerminalCwd({})).toBe('')
  })

  it('returns empty string when all inputs are null', () => {
    expect(resolveTerminalCwd({ currentFilePath: null, currentDir: null, requestedCwd: null })).toBe('')
  })

  it('returns empty string when all inputs are empty strings', () => {
    expect(resolveTerminalCwd({ currentFilePath: '', currentDir: '', requestedCwd: '' })).toBe('')
  })

  it('prioritizes requestedCwd over currentFilePath and currentDir', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'web/src/App.vue', currentDir: 'docs', requestedCwd: 'cmd/server' })).toBe('cmd/server')
  })

  it('prioritizes currentFilePath over currentDir', () => {
    expect(resolveTerminalCwd({ currentFilePath: 'web/src/App.vue', currentDir: 'docs' })).toBe('web/src')
  })

  it('normalizes the requested cwd path', () => {
    expect(resolveTerminalCwd({ requestedCwd: '///a/b///' })).toBe('a/b')
  })
})

describe('shouldPromptForTerminalReopen edge cases', () => {
  it('does not prompt when current cwd is empty', () => {
    expect(shouldPromptForTerminalReopen('', '/repo/web/src')).toBe(false)
  })

  it('does not prompt when target cwd is empty', () => {
    expect(shouldPromptForTerminalReopen('/repo/web/src', '')).toBe(false)
  })

  it('does not prompt when both cwds are empty', () => {
    expect(shouldPromptForTerminalReopen('', '')).toBe(false)
  })

  it('prompts when paths differ only by trailing slash normalization', () => {
    // Both get trailing slashes stripped, so '/repo/web/src/' → '/repo/web/src' === '/repo/web/src'
    expect(shouldPromptForTerminalReopen('/repo/web/src/', '/repo/web/src')).toBe(false)
  })

  it('prompts when one path has multiple trailing slashes', () => {
    expect(shouldPromptForTerminalReopen('/repo/web/src///', '/repo/web/src')).toBe(false)
  })

  it('handles paths with only a single slash', () => {
    expect(shouldPromptForTerminalReopen('/', '/')).toBe(false)
  })
})
