import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

const STORAGE_KEY = 'clawbench-locale'

function detectLocale(): string {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && ['zh', 'en'].includes(saved)) return saved
  const nav = navigator.language || ''
  return nav.startsWith('zh') ? 'zh' : 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'zh',
  messages: { zh, en },
})

export default i18n
export { STORAGE_KEY }
