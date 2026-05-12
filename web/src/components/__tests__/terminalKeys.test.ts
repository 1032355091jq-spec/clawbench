import { describe, expect, it } from 'vitest'
import { useTerminalKeys } from '@/composables/useTerminalKeys'

describe('useTerminalKeys', () => {
  function createKeys() {
    const sent: string[] = []
    const sendInput = (data: string) => { sent.push(data) }
    const keys = useTerminalKeys(sendInput)
    return { keys, sent }
  }

  describe('modifier state machine', () => {
    it('inactive → once on tap', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.activeModifiers.value.ctrl).toBe('once')
    })

    it('inactive → locked on long-press', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', true)
      expect(keys.activeModifiers.value.ctrl).toBe('locked')
    })

    it('once → inactive on tap', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false) // inactive → once
      keys.toggleModifier('ctrl', false) // once → inactive
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
    })

    it('once → locked on long-press', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false) // inactive → once
      keys.toggleModifier('ctrl', true)  // once → locked
      expect(keys.activeModifiers.value.ctrl).toBe('locked')
    })

    it('locked → inactive on tap', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', true)  // inactive → locked
      keys.toggleModifier('ctrl', false) // locked → inactive
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
    })

    it('same state machine works for alt and shift', () => {
      const { keys } = createKeys()
      keys.toggleModifier('alt', false)
      expect(keys.activeModifiers.value.alt).toBe('once')
      keys.toggleModifier('shift', true)
      expect(keys.activeModifiers.value.shift).toBe('locked')
    })
  })

  describe('clearOnceModifiers', () => {
    it('clears once but not locked modifiers', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false) // once
      keys.toggleModifier('alt', true)   // locked
      keys.clearOnceModifiers()
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
      expect(keys.activeModifiers.value.alt).toBe('locked')
    })
  })

  describe('processInput — Ctrl combinations', () => {
    it('Ctrl+A → \\x01', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('a')).toBe('\x01')
      // once modifier should auto-clear
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
    })

    it('Ctrl+Z → \\x1a', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('z')).toBe('\x1a')
    })

    it('Ctrl+[ → \\x1b (Esc)', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('[')).toBe('\x1b')
    })

    it('Ctrl+\\ → \\x1c', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('\\')).toBe('\x1c')
    })

    it('Ctrl+] → \\x1d', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput(']')).toBe('\x1d')
    })

    it('Ctrl+@ → \\x00', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('@')).toBe('\x00')
    })

    it('Ctrl+^ → \\x1e', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('^')).toBe('\x1e')
    })

    it('Ctrl+_ → \\x1f', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('_')).toBe('\x1f')
    })

    it('Ctrl+uppercase letter works same as lowercase', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('C')).toBe('\x03')
    })

    it('Ctrl with locked modifier stays active after one key', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', true) // locked
      keys.processInput('a')
      expect(keys.activeModifiers.value.ctrl).toBe('locked')
    })
  })

  describe('processInput — Alt combinations', () => {
    it('Alt+x → \\x1bx', () => {
      const { keys } = createKeys()
      keys.toggleModifier('alt', false)
      expect(keys.processInput('x')).toBe('\x1bx')
      expect(keys.activeModifiers.value.alt).toBe('inactive')
    })

    it('Alt with locked modifier stays active', () => {
      const { keys } = createKeys()
      keys.toggleModifier('alt', true) // locked
      keys.processInput('a')
      expect(keys.activeModifiers.value.alt).toBe('locked')
    })
  })

  describe('processInput — Shift combinations', () => {
    it('Shift+Tab → \\x1b[Z', () => {
      const { keys } = createKeys()
      keys.toggleModifier('shift', false)
      expect(keys.processInput('\t')).toBe('\x1b[Z')
      expect(keys.activeModifiers.value.shift).toBe('inactive')
    })
  })

  describe('processInput — no modifier passthrough', () => {
    it('passes through input unchanged when no modifiers active', () => {
      const { keys } = createKeys()
      expect(keys.processInput('hello')).toBe('hello')
    })
  })

  describe('processInput — fallthrough paths', () => {
    it('Ctrl with a digit returns the digit unchanged and clears once modifier', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('5')).toBe('5')
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
    })

    it('Ctrl with a special character not in the special cases returns unchanged', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      expect(keys.processInput('!')).toBe('!')
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
    })

    it('Alt with multi-character input returns unchanged and clears once modifier', () => {
      const { keys } = createKeys()
      keys.toggleModifier('alt', false)
      expect(keys.processInput('hello')).toBe('hello')
      expect(keys.activeModifiers.value.alt).toBe('inactive')
    })

    it('Shift with non-tab character returns unchanged and clears once modifier', () => {
      const { keys } = createKeys()
      keys.toggleModifier('shift', false)
      expect(keys.processInput('a')).toBe('a')
      expect(keys.activeModifiers.value.shift).toBe('inactive')
    })

    it('Shift+Enter returns \\r unchanged and clears once modifier', () => {
      const { keys } = createKeys()
      keys.toggleModifier('shift', false)
      expect(keys.processInput('\r')).toBe('\r')
      expect(keys.activeModifiers.value.shift).toBe('inactive')
    })

    it('multiple modifiers active: Ctrl takes priority over Shift for alpha', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', false)
      keys.toggleModifier('shift', false)
      // Ctrl+C should still work even with Shift also active
      expect(keys.processInput('c')).toBe('\x03')
    })
  })

  describe('send functions', () => {
    it('sendCtrlC sends \\x03', () => {
      const { keys, sent } = createKeys()
      keys.sendCtrlC()
      expect(sent).toEqual(['\x03'])
    })

    it('sendCtrlZ sends \\x1a', () => {
      const { keys, sent } = createKeys()
      keys.sendCtrlZ()
      expect(sent).toEqual(['\x1a'])
    })

    it('sendEscape sends \\x1b', () => {
      const { keys, sent } = createKeys()
      keys.sendEscape()
      expect(sent).toEqual(['\x1b'])
    })

    it('sendTab sends \\t', () => {
      const { keys, sent } = createKeys()
      keys.sendTab()
      expect(sent).toEqual(['\t'])
    })

    it('sendArrowUp sends \\x1b[A', () => {
      const { keys, sent } = createKeys()
      keys.sendArrowUp()
      expect(sent).toEqual(['\x1b[A'])
    })

    it('sendArrowDown sends \\x1b[B', () => {
      const { keys, sent } = createKeys()
      keys.sendArrowDown()
      expect(sent).toEqual(['\x1b[B'])
    })

    it('sendArrowRight sends \\x1b[C', () => {
      const { keys, sent } = createKeys()
      keys.sendArrowRight()
      expect(sent).toEqual(['\x1b[C'])
    })

    it('sendArrowLeft sends \\x1b[D', () => {
      const { keys, sent } = createKeys()
      keys.sendArrowLeft()
      expect(sent).toEqual(['\x1b[D'])
    })

    it('sendHome sends \\x1b[H', () => {
      const { keys, sent } = createKeys()
      keys.sendHome()
      expect(sent).toEqual(['\x1b[H'])
    })

    it('sendEnd sends \\x1b[F', () => {
      const { keys, sent } = createKeys()
      keys.sendEnd()
      expect(sent).toEqual(['\x1b[F'])
    })

    it('sendPageUp sends \\x1b[5~', () => {
      const { keys, sent } = createKeys()
      keys.sendPageUp()
      expect(sent).toEqual(['\x1b[5~'])
    })

    it('sendPageDown sends \\x1b[6~', () => {
      const { keys, sent } = createKeys()
      keys.sendPageDown()
      expect(sent).toEqual(['\x1b[6~'])
    })

    it('sendEnter sends \\r', () => {
      const { keys, sent } = createKeys()
      keys.sendEnter()
      expect(sent).toEqual(['\r'])
    })

    it('sendBackspace sends \\x7f', () => {
      const { keys, sent } = createKeys()
      keys.sendBackspace()
      expect(sent).toEqual(['\x7f'])
    })

    it('sendDelete sends \\x1b[3~', () => {
      const { keys, sent } = createKeys()
      keys.sendDelete()
      expect(sent).toEqual(['\x1b[3~'])
    })
  })

  describe('reset', () => {
    it('resets all modifiers to inactive', () => {
      const { keys } = createKeys()
      keys.toggleModifier('ctrl', true)
      keys.toggleModifier('alt', false)
      keys.toggleModifier('shift', true)
      keys.reset()
      expect(keys.activeModifiers.value.ctrl).toBe('inactive')
      expect(keys.activeModifiers.value.alt).toBe('inactive')
      expect(keys.activeModifiers.value.shift).toBe('inactive')
    })
  })
})
