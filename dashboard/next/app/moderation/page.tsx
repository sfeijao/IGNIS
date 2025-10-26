import dynamic from 'next/dynamic'

const ModerationSummary = dynamic(() => import('@/components/ModerationSummary'), { ssr: false })

export default function ModerationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Moderação</h1>
      <ModerationSummary />
    </div>
  )
}
