"use client"

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useGuildId } from '@/lib/guild'
import useGiveawaySocket from '@/lib/useGiveawaySocket'
import { useGiveawaysI18n } from '@/lib/useI18nGiveaways'
import GiveawayRoulette from '@/components/GiveawayRoulette'
import GiveawayManager from '@/components/GiveawayManager'
import ParticipantsList from '@/components/ParticipantsList'
import GiveawayStats from '@/components/GiveawayStats'

export default function GiveawayDetailPage(){
  const params = useParams() as any
  const id = params?.id as string
  const guildId = useGuildId()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'roulette'>('overview')
  const [participants, setParticipants] = useState<any[]>([])
  const liveRef = useRef<HTMLDivElement|null>(null)
  const t = useGiveawaysI18n()

  const reload = () => {
    if (!guildId || !id) return
    fetch(`/api/guilds/${guildId}/giveaways/${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        if (json.ok !== false) setData(json)
      })
      .catch(() => {})
  }

  const loadAllParticipants = async () => {
    if (!guildId || !id) return
    try {
      // Carregar todos os participantes para a roleta
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${id}/entries?limit=1000`, { credentials: 'include' })
      const json = await res.json()
      if (json.ok !== false) {
        setParticipants(json.entries || [])
      }
    } catch (e) {
      console.error('Failed to load participants:', e)
    }
  }

  useEffect(()=>{
    reload()
  }, [guildId, id])

  useEffect(() => {
    if (activeTab === 'roulette') {
      loadAllParticipants()
    }
  }, [activeTab, guildId, id])

  useGiveawaySocket(guildId, (evt: any) => {
    if (!evt || !evt.type) return
    if (evt.type === 'giveaway_enter' && evt.giveawayId === id) {
      setData((prev: any) => prev ? { ...prev, entriesCount: (prev.entriesCount||0)+1 } : prev)
      if (liveRef.current) liveRef.current.textContent = t('giveaways.live.updateEntrant')
    }
    if (evt.type === 'giveaway_end' && evt.giveawayId === id) {
      setData((prev: any) => prev ? { ...prev, giveaway: { ...prev.giveaway, status: 'ended' } } : prev)
      if (liveRef.current) liveRef.current.textContent = t('giveaways.live.ended')
    }
    if (evt.type === 'giveaway_reroll' && evt.giveawayId === id) {
      if (liveRef.current) liveRef.current.textContent = t('giveaways.live.reroll')
      reload()
    }
  })

  if (!id) return <div className="p-4">{t('giveaways.error.invalidId','Invalid ID')}</div>

  return (
    <div className="p-4 flex flex-col gap-4">
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!data ? (
        <div aria-live="polite">{t('giveaways.loading','Loading...')}</div>
      ) : (
        <>
          {/* Cabeçalho do Giveaway */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="text-2xl font-bold flex items-center gap-3">
                  <span className="text-3xl">{data.giveaway?.icon_emoji || '🎉'}</span>
                  <span>{data.giveaway?.title}</span>
                </div>
                {data.giveaway?.description && (
                  <div className="mt-2 text-neutral-300">{data.giveaway.description}</div>
                )}
              </div>

              {/* Badge de Status */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.giveaway?.status === 'active' ? 'bg-green-900/30 text-green-400 border border-green-700' :
                data.giveaway?.status === 'ended' ? 'bg-neutral-800 text-neutral-400 border border-neutral-700' :
                'bg-yellow-900/30 text-yellow-400 border border-yellow-700'
              }`}>
                {data.giveaway?.status === 'active' ? '🟢 Ativo' :
                 data.giveaway?.status === 'ended' ? '⚫ Terminado' : '🟡 Agendado'}
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-neutral-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{data.entriesCount || 0}</div>
                <div className="text-sm text-neutral-400">Participantes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{data.giveaway?.winners_count || 1}</div>
                <div className="text-sm text-neutral-400">Vencedores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {data.giveaway?.ends_at ? new Date(data.giveaway.ends_at).toLocaleDateString('pt-PT') : '-'}
                </div>
                <div className="text-sm text-neutral-400">Data Término</div>
              </div>
            </div>

            {/* Vencedores */}
            {data.winners?.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  <span>🏆</span>
                  <span>Vencedores</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.winners.map((w:any, idx: number)=> (
                    <div key={w._id} className="px-3 py-2 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-700/40 rounded-lg">
                      <span className="font-medium">#{idx + 1}</span> {w.user_id}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações de Gestão */}
            <div className="mt-6">
              <GiveawayManager
                giveaway={data.giveaway}
                guildId={guildId!}
                onUpdate={reload}
              />
            </div>
          </div>

          {/* Tabs de Navegação */}
          <div className="flex gap-2 border-b border-neutral-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              📊 Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'participants'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              👥 Participantes ({data.entriesCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('roulette')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'roulette'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              🎰 Roleta de Sorteio
            </button>
          </div>

          {/* Conteúdo das Tabs */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50">
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                {/* Estatísticas em Tempo Real */}
                <div>
                  <h3 className="font-semibold mb-4 text-lg">📈 Estatísticas em Tempo Real</h3>
                  <GiveawayStats giveaway={data.giveaway} entriesCount={data.entriesCount || 0} />
                </div>

                {/* Detalhes */}
                <div>
                  <h3 className="font-semibold mb-3">📝 Detalhes</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                      <span className="text-neutral-400">Canal:</span>
                      <span className="font-mono">{data.giveaway?.channel_id}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                      <span className="text-neutral-400">Método:</span>
                      <span>{data.giveaway?.method || 'button'}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                      <span className="text-neutral-400">Criado em:</span>
                      <span>{data.giveaway?.created_at ? new Date(data.giveaway.created_at).toLocaleString('pt-PT') : '-'}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                      <span className="text-neutral-400">Termina em:</span>
                      <span>{data.giveaway?.ends_at ? new Date(data.giveaway.ends_at).toLocaleString('pt-PT') : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <a
                    href={`/api/guilds/${guildId}/giveaways/${id}/entries/export`}
                    className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors inline-flex items-center gap-2"
                  >
                    📥 Exportar CSV
                  </a>
                </div>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="p-6">
                <ParticipantsList guildId={guildId!} giveawayId={id} />
              </div>
            )}

            {activeTab === 'roulette' && (
              <div className="p-6">
                {data.entriesCount === 0 ? (
                  <div className="text-center py-12 text-neutral-500">
                    Ainda não há participantes para sortear
                  </div>
                ) : (
                  <GiveawayRoulette
                    participants={participants}
                    winnersCount={data.giveaway?.winners_count || 1}
                    onComplete={(winners) => {
                      // Winners selected, API call can be added here
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  )
}
