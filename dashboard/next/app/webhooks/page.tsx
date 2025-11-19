"use client"
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n'

const WebhookConfigSimple = dynamic(() => import('@/components/WebhookConfigSimple'), { ssr: false })

export default function WebhooksPage() {
  const { t } = useI18n()
  return (
    <div className="p-6">
      <WebhookConfigSimple />
    </div>
  )
}
