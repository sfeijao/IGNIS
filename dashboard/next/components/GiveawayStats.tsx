"use client"

import { useMemo } from 'react'

interface GiveawayStatsProps {
  giveaway: any
  entriesCount: number
}

export default function GiveawayStats({ giveaway, entriesCount }: GiveawayStatsProps) {
  const stats = useMemo(() => {
    if (!giveaway) return null

    const now = new Date()
    const endsAt = new Date(giveaway.ends_at)
    const createdAt = new Date(giveaway.created_at || giveaway.starts_at)

    // Tempo restante
    const timeRemaining = endsAt.getTime() - now.getTime()
    const daysLeft = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
    const hoursLeft = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutesLeft = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))

    // Duração total
    const totalDuration = endsAt.getTime() - createdAt.getTime()
    const elapsedTime = now.getTime() - createdAt.getTime()
    const progressPercent = Math.min(100, Math.max(0, (elapsedTime / totalDuration) * 100))

    // Taxa de participação
    const hoursElapsed = Math.max(1, elapsedTime / (1000 * 60 * 60))
    const entriesPerHour = (entriesCount / hoursElapsed).toFixed(1)

    // Projeção de participantes no final
    const hoursTotal = totalDuration / (1000 * 60 * 60)
    const projectedEntries = Math.round((entriesCount / hoursElapsed) * hoursTotal)

    // Probabilidade de ganhar
    const winChance = entriesCount > 0
      ? ((giveaway.winners_count / entriesCount) * 100).toFixed(2)
      : '0.00'

    return {
      timeRemaining: timeRemaining > 0 ? `${daysLeft}d ${hoursLeft}h ${minutesLeft}m` : 'Terminado',
      progressPercent: progressPercent.toFixed(1),
      entriesPerHour,
      projectedEntries,
      winChance,
      isActive: giveaway.status === 'active',
      isEnded: giveaway.status === 'ended'
    }
  }, [giveaway, entriesCount])

  if (!stats) return null

  return (
    <div className="space-y-4">
      {/* Barra de Progresso */}
      {stats.isActive && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-neutral-400">Tempo Restante</span>
            <span className="font-medium text-blue-400">{stats.timeRemaining}</span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-neutral-500 mt-1 text-right">
            {stats.progressPercent}% completo
          </div>
        </div>
      )}

      {/* Métricas Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-800/30">
          <div className="text-sm text-blue-300 mb-1">Taxa de Entrada</div>
          <div className="text-2xl font-bold text-blue-400">{stats.entriesPerHour}</div>
          <div className="text-xs text-neutral-400 mt-1">participantes/hora</div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-800/30">
          <div className="text-sm text-purple-300 mb-1">Projeção Final</div>
          <div className="text-2xl font-bold text-purple-400">{stats.projectedEntries}</div>
          <div className="text-xs text-neutral-400 mt-1">participantes estimados</div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-800/30">
          <div className="text-sm text-green-300 mb-1">Probabilidade</div>
          <div className="text-2xl font-bold text-green-400">{stats.winChance}%</div>
          <div className="text-xs text-neutral-400 mt-1">chance de ganhar</div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-orange-900/20 to-orange-800/10 border border-orange-800/30">
          <div className="text-sm text-orange-300 mb-1">Vencedores</div>
          <div className="text-2xl font-bold text-orange-400">{giveaway.winners_count}</div>
          <div className="text-xs text-neutral-400 mt-1">serão sorteados</div>
        </div>
      </div>

      {/* Alertas */}
      {stats.isActive && entriesCount < giveaway.winners_count && (
        <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-yellow-300 text-sm">
          ⚠️ Participantes insuficientes para o número de vencedores configurado
        </div>
      )}

      {stats.isEnded && (
        <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm">
          ✅ Giveaway terminado
        </div>
      )}
    </div>
  )
}
