import ServerStatsConfig from '@/components/ServerStatsConfig'

export const dynamic = 'force-dynamic'

export default function ServerStatsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            📊 Contadores de Estatísticas
          </h1>
          <p className="text-gray-400 mt-1">Configure canais de voz com estatísticas do servidor em tempo real</p>
        </div>
        <ServerStatsConfig />
      </div>
    </div>
  )
}
