"use client"
import dynamic from 'next/dynamic'

const OutgoingWebhooksManager = dynamic(() => import('@/components/OutgoingWebhooksManager'), { ssr: false })

export default function OutgoingWebhooksPage(){
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Outgoing Webhooks</h1>
      <OutgoingWebhooksManager />
    </div>
  )
}
