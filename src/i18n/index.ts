/**
 * Translations (NFR-039). English ships now; French is added by creating
 * locales/fr/common.json with the same keys and listing it in `resources`.
 * The active language follows the business setting (see BusinessProvider).
 */
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import common from './locales/en/common.json'

export const defaultNS = 'common'
export const resources = { en: { common } } as const
export const SUPPORTED_LANGUAGES = Object.keys(resources) as (keyof typeof resources)[]

/** The app's i18next instance (a dedicated one, not the library's global). */
export const i18n = createInstance()

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: [defaultNS],
  interpolation: { escapeValue: false }, // React already escapes output
})

export function setLanguage(language: string) {
  const supported = (SUPPORTED_LANGUAGES as string[]).includes(language) ? language : 'en'
  if (i18n.language !== supported) void i18n.changeLanguage(supported)
  document.documentElement.lang = supported
}
