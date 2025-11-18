import TimeTrackingManager from '@/components/TimeTrackingManager'

export const dynamic = 'force-dynamic'

export default function TimeTrackingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            ⏱️ Time Tracking (Bate-Ponto)
          </h1>
          <p className="text-gray-400 mt-1">Sistema de controlo de tempo de trabalho/presença dos membros</p>
        </div>
        <TimeTrackingManager />
      </div>
    </div>
  )
}
