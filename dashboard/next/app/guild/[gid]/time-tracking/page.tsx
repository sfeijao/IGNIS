"use client"

import { useState } from 'react'
import TimeTrackingManager from '@/components/TimeTrackingManager'
import TimeTrackingPanelConfig from '@/components/TimeTrackingPanelConfig'

export const dynamic = 'force-dynamic'

export default function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'reports'>('config')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            ⏱️ BAT (Bate-Ponto)
          </h1>
          <p className="text-gray-400 mt-1">Sistema de controlo de tempo de trabalho/presença dos membros</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'config'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-orange-500/30'
                : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            ⚙️ Configurar Painéis
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'reports'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-orange-500/30'
                : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            📊 Ver Relatórios
          </button>
        </div>

        {/* Content */}
        {activeTab === 'config' && <TimeTrackingPanelConfig />}
        {activeTab === 'reports' && <TimeTrackingManager />}
      </div>
    </div>
  )
}
