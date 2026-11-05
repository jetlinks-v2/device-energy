import zh from '../locales/lang/zh.json' with { type: 'json' }
import en from '../locales/lang/en.json' with { type: 'json' }

type TextKey = keyof typeof zh.FacilityEnergy.text

/** The Cloud language selector persists this value before reloading the application. */
export function feLocale(): 'zh' | 'en' {
  if (typeof localStorage === 'undefined') return 'zh'
  const stored = localStorage.getItem('Accept-Language') || 'zh'
  return stored.replaceAll('"', '').startsWith('en') ? 'en' : 'zh'
}

/** Shared by the Cloud module and standalone H5, without importing a PC runtime. */
export function feText(key: TextKey): string {
  return (feLocale() === 'en' ? en : zh).FacilityEnergy.text[key]
}

export function setFeLocale(locale: 'zh' | 'en') {
  localStorage.setItem('Accept-Language', locale)
  window.location.reload()
}
