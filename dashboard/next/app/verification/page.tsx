"use client"
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n'

const VerificationConfig = dynamic(() => import('@/components/VerificationConfig'), { ssr: false })

export default function VerificationPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('verification.title')}</h1>
      <VerificationConfig />
    </div>
  )
}
