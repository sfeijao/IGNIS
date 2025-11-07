import dynamic from 'next/dynamic'

// Gradual native port: reuse existing native components first
const ModerationSummary = dynamic(() => import('@/components/ModerationSummary'), { ssr: false })
const ModerationCenterTools = dynamic(() => import('@/components/ModerationCenterTools'), { ssr: false })

export default function ModerationCenterNative() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Centro de Moderação</h1>
      {/* Quick overview cards */}
      <ModerationSummary />
      {/* Tools/actions ported from legacy page */}
      <ModerationCenterTools />
      {/* Placeholder sections for future ports from the legacy center (logs, queues, etc.) */}
      <div className="card p-4 text-sm text-neutral-300">
        Mais ferramentas em breve: vamos portar gradualmente os módulos restantes do centro de moderação.
      </div>
    </div>
  )
}
