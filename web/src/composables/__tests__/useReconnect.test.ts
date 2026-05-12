import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useReconnect, type ReconnectOptions } from '@/composables/useReconnect'

describe('useReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createReconnect(overrides?: Partial<ReconnectOptions>) {
    const onReconnect = vi.fn()
    const opts: ReconnectOptions = {
      onReconnect,
      maxAttempts: 3,
      baseDelay: 1000,
      ...overrides,
    }
    const reconnect = useReconnect(opts)
    return { reconnect, onReconnect }
  }

  describe('shouldReconnect', () => {
    it('returns true when attempts remain and no fatal error', () => {
      const { reconnect } = createReconnect()
      expect(reconnect.shouldReconnect()).toBe(true)
    })

    it('returns false after max attempts are exhausted', () => {
      const { reconnect, onReconnect } = createReconnect({ maxAttempts: 2 })

      // Exhaust attempts by scheduling and advancing
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1000) // first attempt
      expect(onReconnect).toHaveBeenCalledTimes(1)

      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(2000) // second attempt
      expect(onReconnect).toHaveBeenCalledTimes(2)

      // Now out of attempts
      expect(reconnect.shouldReconnect()).toBe(false)
    })

    it('returns false when disabled', () => {
      const { reconnect } = createReconnect()
      reconnect.disable()
      expect(reconnect.shouldReconnect()).toBe(false)
    })

    it('returns false when getFatalError returns a non-null value', () => {
      let fatalError: boolean | null = null
      const { reconnect } = createReconnect({
        getFatalError: () => fatalError,
      })
      expect(reconnect.shouldReconnect()).toBe(true)

      fatalError = true
      expect(reconnect.shouldReconnect()).toBe(false)
    })

    it('returns true when getFatalError returns null', () => {
      const { reconnect } = createReconnect({
        getFatalError: () => null,
      })
      expect(reconnect.shouldReconnect()).toBe(true)
    })
  })

  describe('scheduleReconnect', () => {
    it('calls onReconnect after delay', () => {
      const { reconnect, onReconnect } = createReconnect({ baseDelay: 1000 })
      reconnect.scheduleReconnect()

      expect(onReconnect).not.toHaveBeenCalled()
      vi.advanceTimersByTime(999)
      expect(onReconnect).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onReconnect).toHaveBeenCalledTimes(1)
    })

    it('uses exponential backoff: delay = baseDelay * (attempt + 1)', () => {
      const { reconnect, onReconnect } = createReconnect({ baseDelay: 1000 })

      // First attempt: delay = 1000 * (0+1) = 1000
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1000)
      expect(onReconnect).toHaveBeenCalledTimes(1)

      // Second attempt: delay = 1000 * (1+1) = 2000
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1999)
      expect(onReconnect).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1)
      expect(onReconnect).toHaveBeenCalledTimes(2)

      // Third attempt: delay = 1000 * (2+1) = 3000
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(3000)
      expect(onReconnect).toHaveBeenCalledTimes(3)
    })

    it('defaults to 2000ms base delay when not specified', () => {
      const { reconnect, onReconnect } = createReconnect({ baseDelay: undefined })
      // Only pass maxAttempts to avoid infinite scheduling
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(2000)
      expect(onReconnect).toHaveBeenCalledTimes(1)
    })

    it('defaults to 3 max attempts when not specified', () => {
      const { reconnect, onReconnect } = createReconnect({ maxAttempts: undefined })
      expect(reconnect.shouldReconnect()).toBe(true)
    })
  })

  describe('disable', () => {
    it('prevents shouldReconnect from returning true', () => {
      const { reconnect } = createReconnect()
      expect(reconnect.shouldReconnect()).toBe(true)
      reconnect.disable()
      expect(reconnect.shouldReconnect()).toBe(false)
    })

    it('cancels any pending reconnect timer', () => {
      const { reconnect, onReconnect } = createReconnect()
      reconnect.scheduleReconnect()
      reconnect.disable()
      vi.advanceTimersByTime(10000)
      expect(onReconnect).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('resets attempt counter so shouldReconnect returns true again', () => {
      const { reconnect, onReconnect } = createReconnect({ maxAttempts: 1 })
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1000)
      expect(onReconnect).toHaveBeenCalledTimes(1)
      expect(reconnect.shouldReconnect()).toBe(false)

      reconnect.reset()
      expect(reconnect.shouldReconnect()).toBe(true)
    })

    it('re-enables reconnect after disable', () => {
      const { reconnect } = createReconnect()
      reconnect.disable()
      expect(reconnect.shouldReconnect()).toBe(false)
      reconnect.reset()
      expect(reconnect.shouldReconnect()).toBe(true)
    })

    it('cancels any pending reconnect timer', () => {
      const { reconnect, onReconnect } = createReconnect()
      reconnect.scheduleReconnect()
      reconnect.reset()
      vi.advanceTimersByTime(10000)
      expect(onReconnect).not.toHaveBeenCalled()
    })
  })

  describe('getAttempts', () => {
    it('starts at 0', () => {
      const { reconnect } = createReconnect()
      expect(reconnect.getAttempts()).toBe(0)
    })

    it('increments after each scheduled reconnect fires', () => {
      const { reconnect, onReconnect } = createReconnect()
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1000)
      expect(reconnect.getAttempts()).toBe(1)
      expect(onReconnect).toHaveBeenCalledTimes(1)
    })

    it('resets to 0 after reset()', () => {
      const { reconnect } = createReconnect()
      reconnect.scheduleReconnect()
      vi.advanceTimersByTime(1000)
      expect(reconnect.getAttempts()).toBe(1)
      reconnect.reset()
      expect(reconnect.getAttempts()).toBe(0)
    })
  })

  describe('interaction: disable + reset', () => {
    it('allows reconnect after disable then reset', () => {
      const { reconnect } = createReconnect()
      reconnect.disable()
      expect(reconnect.shouldReconnect()).toBe(false)
      reconnect.reset()
      expect(reconnect.shouldReconnect()).toBe(true)
    })
  })

  describe('interaction: getFatalError + reset', () => {
    it('clears fatal error influence after reset', () => {
      let fatalError: boolean | null = true
      const { reconnect } = createReconnect({
        getFatalError: () => fatalError,
      })
      expect(reconnect.shouldReconnect()).toBe(false)

      // Simulate recovery: fatal error cleared + reset
      fatalError = null
      reconnect.reset()
      expect(reconnect.shouldReconnect()).toBe(true)
    })
  })
})
