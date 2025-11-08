"use client"

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useGuildId } from '@/lib/guild'
import useGiveawaySocket from '@/lib/useGiveawaySocket'
import { useGiveawaysI18n } from '@/lib/useI18nGiveaways'

export default function GiveawayDetailPage(){
  const params = useParams() as any
  const id = params?.id as string
  const guildId = useGuildId()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string|null>(null)
  const liveRef = useRef<HTMLDivElement|null>(null)
  const t = useGiveawaysI18n()

  useEffect(()=>{
    async function run(){
      if (!guildId || !id) return
      try {
        const res = await fetch(`/api/guilds/${guildId}/giveaways/${id}`, { credentials: 'include' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'detail_failed')
        setData(json)
      } catch (e:any) {
        setError(e.message || String(e))
      }
    }
    run()
  }, [guildId, id])

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
    }
  })

  if (!id) return <div className="p-4">{t('giveaways.error.invalidId','Invalid ID')}</div>
  return (
    <div className="p-4 flex flex-col gap-4">
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!data ? (
        <div aria-live="polite">{t('giveaways.loading','Loading...')}</div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-xl font-semibold flex items-center gap-2"><span>🎉</span><span>{data.giveaway?.title}</span></div>
          <div className="mt-2 opacity-80">{data.giveaway?.description}</div>
          <div className="mt-3 text-sm opacity-70 flex gap-4">
            <span>{t('giveaways.label.status','Status')}: {data.giveaway?.status}</span>
            <span>{t('giveaways.field.entries','Entries')}: {data.entriesCount}</span>
            <span>{t('giveaways.field.winners')}: {data.giveaway?.winners_count}</span>
          </div>
          {!!data.winners?.length && (
            <div className="mt-4">
              <div className="font-medium mb-1">{t('giveaways.field.winners')}</div>
              <div className="text-sm opacity-90 flex flex-wrap gap-2">
                {data.winners.map((w:any)=> <span key={w._id} className="px-2 py-1 bg-neutral-800 rounded">{w.user_id}</span>)}
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <a href={`/api/guilds/${guildId}/giveaways/${id}/entries/export`} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">CSV</a>
          </div>
        </div>
      )}
      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  )
}
