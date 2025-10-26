import dynamic from 'next/dynamic'

const WebhooksManager = dynamic(() => import('@/components/WebhooksManager'), { ssr: false })

export default function WebhooksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Webhooks</h1>
      <WebhooksManager />
    </div>
  )
}
