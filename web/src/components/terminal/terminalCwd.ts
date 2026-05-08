export interface ResolveTerminalCwdInput {
  currentFilePath?: string | null
  currentDir?: string | null
  requestedCwd?: string | null
}

function normalizeRelativePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

function dirname(path: string): string {
  const normalized = normalizeRelativePath(path)
  const slash = normalized.lastIndexOf('/')
  if (slash <= 0) return ''
  return normalized.slice(0, slash)
}

export function resolveTerminalCwd(input: ResolveTerminalCwdInput): string {
  if (input.requestedCwd) {
    return normalizeRelativePath(input.requestedCwd)
  }
  if (input.currentFilePath) {
    return dirname(input.currentFilePath)
  }
  if (input.currentDir) {
    return normalizeRelativePath(input.currentDir)
  }
  return ''
}

function normalizeAbsolutePath(path: string): string {
  if (!path) return ''
  return path.replace(/\/+$/, '')
}

export function shouldPromptForTerminalReopen(currentCwd: string, targetCwd: string): boolean {
  const current = normalizeAbsolutePath(currentCwd)
  const target = normalizeAbsolutePath(targetCwd)
  return Boolean(current && target && current !== target)
}
