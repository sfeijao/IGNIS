import WelcomeGoodbyeConfig from '@/components/WelcomeGoodbyeConfig'

export const dynamic = 'force-dynamic'

export default function WelcomeGoodbyePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            👋 Sistema de Boas-Vindas & Despedidas
          </h1>
          <p className="text-gray-400 mt-1">Configure mensagens personalizadas para novos membros e saídas</p>
        </div>
        <WelcomeGoodbyeConfig />
      </div>
    </div>
  )
}
