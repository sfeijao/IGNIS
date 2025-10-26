import dynamic from 'next/dynamic'

const PerformancePanel = dynamic(() => import('@/components/PerformancePanel'), { ssr: false })

export default function PerformancePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Performance</h1>
      <PerformancePanel />
    </div>
  )
}
