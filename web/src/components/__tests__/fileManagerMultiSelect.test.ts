import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { reactive, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

// ────────────────────────────────────────────────────────────
// File manager multi-select logic tests.
//
// We test the core multi-select behaviors as replicated pure
// functions (Pattern A) plus a component mount test for the
// toolbar button (Pattern C).
// ────────────────────────────────────────────────────────────

// ============================================================
// Part 1: Multi-select state logic (pure function replication)
// ============================================================

// Replicate the multi-select state and functions from FileManagerContent.vue
function createMultiSelect() {
  const state = reactive({
    active: false,
    selected: new Set<string>(),
  })

  function enterMultiSelect() {
    state.active = true
    state.selected.clear()
  }

  function exitMultiSelect() {
    state.active = false
    state.selected.clear()
  }

  function toggleSelect(path: string) {
    if (state.selected.has(path)) {
      state.selected.delete(path)
    } else {
      state.selected.add(path)
    }
  }

  return { state, enterMultiSelect, exitMultiSelect, toggleSelect }
}

// Replicate clipboard logic (multi-entry version)
function createClipboard() {
  const clipboard = reactive({ entries: [] as any[], isCut: false })

  function copy(entries: any[]) {
    clipboard.entries = entries
    clipboard.isCut = false
  }

  function cut(entries: any[]) {
    clipboard.entries = entries
    clipboard.isCut = true
  }

  function clear() {
    clipboard.entries = []
    clipboard.isCut = false
  }

  return { clipboard, copy, cut, clear }
}

// Replicate handleFileClick interception logic
function createClickHandler(multiSelect: ReturnType<typeof createMultiSelect>) {
  const navigated: string[] = []
  const selectedFiles: string[] = []

  function handleFileClick(action: string, path: string) {
    if (multiSelect.state.active) {
      multiSelect.toggleSelect(path)
      return
    }
    if (action === 'dir') {
      navigated.push(path)
    } else {
      selectedFiles.push(path)
    }
  }

  return { handleFileClick, navigated, selectedFiles }
}

// ────────────────────────────────────────────────────────────

describe('multi-select state', () => {
  it('starts inactive with empty selection', () => {
    const { state } = createMultiSelect()
    expect(state.active).toBe(false)
    expect(state.selected.size).toBe(0)
  })

  it('enterMultiSelect activates and clears selection', () => {
    const { state, enterMultiSelect, toggleSelect } = createMultiSelect()
    toggleSelect('a.txt')
    enterMultiSelect()
    expect(state.active).toBe(true)
    expect(state.selected.size).toBe(0)
  })

  it('exitMultiSelect deactivates and clears selection', () => {
    const { state, enterMultiSelect, exitMultiSelect, toggleSelect } = createMultiSelect()
    enterMultiSelect()
    toggleSelect('a.txt')
    exitMultiSelect()
    expect(state.active).toBe(false)
    expect(state.selected.size).toBe(0)
  })

  it('toggleSelect adds and removes paths', () => {
    const { state, enterMultiSelect, toggleSelect } = createMultiSelect()
    enterMultiSelect()
    toggleSelect('a.txt')
    expect(state.selected.has('a.txt')).toBe(true)
    toggleSelect('a.txt')
    expect(state.selected.has('a.txt')).toBe(false)
  })

  it('toggleSelect supports multiple items', () => {
    const { state, enterMultiSelect, toggleSelect } = createMultiSelect()
    enterMultiSelect()
    toggleSelect('a.txt')
    toggleSelect('b.txt')
    toggleSelect('dir/c.txt')
    expect(state.selected.size).toBe(3)
    expect(state.selected.has('a.txt')).toBe(true)
    expect(state.selected.has('b.txt')).toBe(true)
    expect(state.selected.has('dir/c.txt')).toBe(true)
  })
})

describe('click interception', () => {
  it('normal mode: dir click navigates', () => {
    const ms = createMultiSelect()
    const { handleFileClick, navigated } = createClickHandler(ms)
    handleFileClick('dir', 'src')
    expect(navigated).toEqual(['src'])
  })

  it('normal mode: file click selects file', () => {
    const ms = createMultiSelect()
    const { handleFileClick, selectedFiles } = createClickHandler(ms)
    handleFileClick('file', 'readme.md')
    expect(selectedFiles).toEqual(['readme.md'])
  })

  it('multi-select mode: dir click toggles selection instead of navigating', () => {
    const ms = createMultiSelect()
    const { handleFileClick, navigated } = createClickHandler(ms)
    ms.enterMultiSelect()
    handleFileClick('dir', 'src')
    expect(navigated).toEqual([])
    expect(ms.state.selected.has('src')).toBe(true)
  })

  it('multi-select mode: file click toggles selection instead of selecting file', () => {
    const ms = createMultiSelect()
    const { handleFileClick, selectedFiles } = createClickHandler(ms)
    ms.enterMultiSelect()
    handleFileClick('file', 'readme.md')
    expect(selectedFiles).toEqual([])
    expect(ms.state.selected.has('readme.md')).toBe(true)
  })

  it('multi-select mode: clicking same item twice deselects', () => {
    const ms = createMultiSelect()
    const { handleFileClick } = createClickHandler(ms)
    ms.enterMultiSelect()
    handleFileClick('file', 'a.txt')
    expect(ms.state.selected.has('a.txt')).toBe(true)
    handleFileClick('file', 'a.txt')
    expect(ms.state.selected.has('a.txt')).toBe(false)
  })
})

describe('clipboard (multi-entry)', () => {
  it('stores single entry from context menu copy', () => {
    const { clipboard, copy } = createClipboard()
    const entry = { name: 'a.txt', path: 'a.txt', type: 'file' }
    copy([entry])
    expect(clipboard.entries).toHaveLength(1)
    expect(clipboard.isCut).toBe(false)
  })

  it('stores multiple entries from batch copy', () => {
    const { clipboard, copy } = createClipboard()
    const entries = [
      { name: 'a.txt', path: 'a.txt', type: 'file' },
      { name: 'b.txt', path: 'b.txt', type: 'file' },
    ]
    copy(entries)
    expect(clipboard.entries).toHaveLength(2)
    expect(clipboard.isCut).toBe(false)
  })

  it('stores multiple entries from batch cut', () => {
    const { clipboard, cut } = createClipboard()
    const entries = [
      { name: 'a.txt', path: 'a.txt', type: 'file' },
      { name: 'src', path: 'src', type: 'dir' },
    ]
    cut(entries)
    expect(clipboard.entries).toHaveLength(2)
    expect(clipboard.isCut).toBe(true)
  })

  it('clear resets entries and isCut', () => {
    const { clipboard, cut, clear } = createClipboard()
    cut([{ name: 'a.txt', path: 'a.txt', type: 'file' }])
    clear()
    expect(clipboard.entries).toHaveLength(0)
    expect(clipboard.isCut).toBe(false)
  })

  it('replacing entries overwrites previous clipboard', () => {
    const { clipboard, copy, cut } = createClipboard()
    copy([{ name: 'old.txt', path: 'old.txt', type: 'file' }])
    cut([{ name: 'new.txt', path: 'new.txt', type: 'file' }])
    expect(clipboard.entries).toHaveLength(1)
    expect(clipboard.entries[0].name).toBe('new.txt')
    expect(clipboard.isCut).toBe(true)
  })
})

describe('batch delete flow', () => {
  it('collects selected paths and emits batchDelete', async () => {
    const ms = createMultiSelect()
    ms.enterMultiSelect()
    ms.toggleSelect('a.txt')
    ms.toggleSelect('b.txt')
    ms.toggleSelect('src')

    const paths = [...ms.state.selected]
    expect(paths).toEqual(['a.txt', 'b.txt', 'src'])

    // After confirmed delete, exit multi-select
    ms.exitMultiSelect()
    expect(ms.state.active).toBe(false)
    expect(ms.state.selected.size).toBe(0)
  })
})

// ============================================================
// Part 2: Component mount test — toolbar button
// ============================================================

// Minimal i18n for component mount
const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  messages: {
    zh: {
      file: {
        sortByName: '按名称',
        sortByTime: '按时间',
        sortByType: '按类型',
        sortAsc: '升序',
        sortDesc: '降序',
        sortDefault: '默认',
        sortClickToClear: '点击清除',
        hideHiddenFiles: '隐藏',
        showHiddenFiles: '显示隐藏',
        syncToCurrentDir: '同步',
        multiSelect: {
          enter: '多选',
          exit: '退出多选',
          tapToSelect: '点击选择',
          selectedCount: '已选 {n} 项',
          selectAll: '全选',
          deselectAll: '取消全选',
        },
        context: {
          copy: '复制',
          cut: '剪切',
          paste: '粘贴',
          newFile: '新建文件',
          newFolder: '新建文件夹',
          newFileInDir: '在 {name} 内新建文件',
          newFolderInDir: '在 {name} 内新建文件夹',
          openAsProject: '打开为项目',
          openTerminal: '在此打开终端',
        },
      },
      search: { defaultPlaceholder: '搜索' },
      nav: { refresh: '刷新' },
      common: { loading: '加载中', rename: '重命名', download: '下载', delete: '删除', copied: '已复制', operationFailed: '操作失败' },
    },
  },
})

vi.mock('@/composables/useAppMode.ts', () => ({
  useAppMode: () => ({ isAppMode: { value: false } }),
}))

vi.mock('@/composables/useDialog.ts', () => ({
  useDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    prompt: vi.fn().mockResolvedValue(''),
  }),
}))

vi.mock('@/stores/app.ts', () => ({
  store: { state: { projectRoot: '/tmp/project' } },
}))

vi.mock('@/utils/fileType.ts', () => ({
  getFileType: () => ({ color: '#666', isImage: false, isAudio: false }),
}))

vi.mock('@/utils/path.ts', () => ({
  dirName: (p: string) => p.split('/').slice(0, -1).join('/') || '',
}))

// Import after mocks
import FileManagerContent from '@/components/file/FileManagerContent.vue'

describe('FileManagerContent — multi-select toolbar button', () => {
  function mountComponent(entries: any[] = []) {
    return mount(FileManagerContent, {
      props: {
        entries,
        currentDir: '',
        currentFile: null,
        showHidden: false,
        sortField: '',
        sortDir: '',
        dirLoading: false,
      },
      global: {
        plugins: [i18n],
        stubs: {
          SearchInput: true,
          DirBreadcrumb: true,
        },
      },
    })
  }

  it('renders the multi-select toolbar button', () => {
    const wrapper = mountComponent()
    // The multi-select button has a title attribute "多选"
    const msButton = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === '多选')
    expect(msButton).toBeTruthy()
  })

  it('clicking multi-select button toggles mode', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('.toolbar-btn')
    const msButton = buttons.find(b => b.attributes('title') === '多选')
    expect(msButton).toBeTruthy()

    // Click to enter multi-select mode
    await msButton!.trigger('click')
    // Should show the info bar with "tapToSelect" text
    expect(wrapper.find('.ms-info-bar').exists()).toBe(true)

    // Click again to exit
    await msButton!.trigger('click')
    expect(wrapper.find('.ms-info-bar').exists()).toBe(false)
  })

  it('shows checkboxes on file items in multi-select mode', async () => {
    const entries = [
      { name: 'test.txt', type: 'file', size: 100, modified: '2025-01-01T00:00:00Z' },
      { name: 'src', type: 'dir', modified: '2025-01-01T00:00:00Z' },
    ]
    const wrapper = mountComponent(entries)

    // No checkboxes before entering multi-select
    expect(wrapper.findAll('.ms-check')).toHaveLength(0)

    // Enter multi-select
    const buttons = wrapper.findAll('.toolbar-btn')
    const msButton = buttons.find(b => b.attributes('title') === '多选')
    await msButton!.trigger('click')

    // Checkboxes should now appear
    await nextTick()
    expect(wrapper.findAll('.ms-check')).toHaveLength(2)
  })

  it('clicking file item in multi-select mode toggles selection', async () => {
    const entries = [
      { name: 'a.txt', type: 'file', size: 100, modified: '2025-01-01T00:00:00Z' },
      { name: 'b.txt', type: 'file', size: 200, modified: '2025-01-01T00:00:00Z' },
    ]
    const wrapper = mountComponent(entries)

    // Enter multi-select
    const buttons = wrapper.findAll('.toolbar-btn')
    const msButton = buttons.find(b => b.attributes('title') === '多选')
    await msButton!.trigger('click')
    await nextTick()

    // Click first file item
    const fileItems = wrapper.findAll('.file-item')
    await fileItems[0].trigger('click')
    await nextTick()

    // Should have one selected item
    const checkedBoxes = wrapper.findAll('.ms-check.checked')
    expect(checkedBoxes.length).toBe(1)

    // Action bar should appear
    expect(wrapper.find('.ms-action-bar').exists()).toBe(true)
  })

  it('emits batchDelete when delete button in action bar is clicked', async () => {
    const entries = [
      { name: 'a.txt', type: 'file', size: 100, modified: '2025-01-01T00:00:00Z' },
    ]
    const wrapper = mountComponent(entries)

    // Enter multi-select
    const buttons = wrapper.findAll('.toolbar-btn')
    const msButton = buttons.find(b => b.attributes('title') === '多选')
    await msButton!.trigger('click')
    await nextTick()

    // Select the file
    await wrapper.find('.file-item').trigger('click')
    await nextTick()

    // The dialog.confirm is mocked to return true, so click delete
    const deleteBtn = wrapper.find('.ms-action-btn.ms-danger')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    await nextTick()

    // Should have emitted batchDelete
    const events = wrapper.emitted('batchDelete')
    expect(events).toBeTruthy()
    expect(events![0][0]).toEqual(['a.txt'])
  })
})
