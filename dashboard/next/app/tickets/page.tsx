"use client"
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n'

const TicketsList = dynamic(() => import('@/components/TicketsList'), { ssr: false })

export default function TicketsPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('tickets.title')}</h1>
      <TicketsList />
    </div>
  )
}
