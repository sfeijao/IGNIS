import dynamic from 'next/dynamic'

const DiagnosticsPanel = dynamic(() => import('@/components/DiagnosticsPanel'), { ssr: false })

export default function DiagnosticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Diagnósticos</h1>
      <DiagnosticsPanel />
    </div>
  )
}
