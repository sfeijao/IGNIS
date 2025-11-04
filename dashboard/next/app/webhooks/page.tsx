"use client"
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n'

const WebhooksManager = dynamic(() => import('@/components/WebhooksManager'), { ssr: false })

export default function WebhooksPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('webhooks.title')}</h1>
      <WebhooksManager />
    </div>
  )
}
