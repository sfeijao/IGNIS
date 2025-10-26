"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'

type VerifyConfig = { enabled?: boolean; channelId?: string; roleId?: string; method?: string }

export default function VerificationConfig() {
  const guildId = getGuildId()
  const [cfg, setCfg] = useState<VerifyConfig>({ enabled: false, method: 'captcha', channelId: '', roleId: '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<'idle'|'saving'|'ok'|'err'>('idle')

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    ;(async () => {
      try {
        const res = await fetch(`/api/guild/${guildId}/verification/config`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (!aborted) setCfg({ enabled: !!data.enabled, channelId: data.channelId || '', roleId: data.roleId || '', method: data.method || 'captcha' })
        }
      } catch {}
    })()
    return () => { aborted = true }
  }, [guildId])

  const save = async () => {
    if (!guildId) return
    setLoading(true); setSaved('saving')
    try {
      const res = await fetch(`/api/guild/${guildId}/verification/config`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(cfg) })
      setSaved(res.ok ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">Selecione um servidor para configurar verificação.</div>}
      <form className="card p-5 max-w-xl space-y-4" onSubmit={(e)=>{ e.preventDefault(); save() }}>
        <div className="flex items-center gap-2">
          <input id="v-enabled" type="checkbox" checked={!!cfg.enabled} onChange={e=> setCfg(c => ({ ...c, enabled: e.target.checked }))} />
          <label htmlFor="v-enabled">Ativar verificação</label>
        </div>
        <div>
          <label className="block text-sm mb-1">Método</label>
          <select className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.method} onChange={e=> setCfg(c=> ({ ...c, method: e.target.value }))} title="Método de verificação">
            <option value="captcha">Captcha</option>
            <option value="button">Botão</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Canal</label>
          <input className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Canal ID" value={cfg.channelId || ''} onChange={e=> setCfg(c=> ({ ...c, channelId: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Cargo verificado</label>
          <input className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Role ID" value={cfg.roleId || ''} onChange={e=> setCfg(c=> ({ ...c, roleId: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-2">
          <button disabled={loading} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">{saved==='saving' ? 'Guardando…' : 'Guardar'}</button>
          {saved==='ok' && <span className="text-emerald-400 text-sm">Guardado!</span>}
          {saved==='err' && <span className="text-rose-400 text-sm">Falhou ao guardar</span>}
        </div>
      </form>
    </div>
  )
}
