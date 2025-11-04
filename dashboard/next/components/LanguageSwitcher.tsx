"use client"

import { useI18n } from "../lib/i18n"

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  return (
    <label className="hidden sm:inline-flex items-center gap-2 text-xs text-neutral-300" title={t('settings.locale')}>
      <select
        className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1"
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
        aria-label={t('settings.locale')}
      >
        <option value="pt">PT</option>
        <option value="en">EN</option>
      </select>
    </label>
  )
}
