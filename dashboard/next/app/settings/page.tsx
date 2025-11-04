"use client"
import SettingsForm from '@/components/SettingsForm'
import { useI18n } from '@/lib/i18n'

export default function SettingsPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <SettingsForm />
    </div>
  )
}
