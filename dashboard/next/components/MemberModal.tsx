const logger = require('../utils/logger');
"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useToast } from './Toaster'

type Props = { guildId: string; member: any; onClose: () => void; onChanged: () => void }

export default function MemberModal({ guildId, member, onClose, onChanged }: Props) {
  const { toast } = useToast()
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [nick, setNick] = useState<string>(member?.nick || '')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set<string>(Array.isArray(member?.roles) ? (member.roles as string[]) : [])
  )
  const [timeoutMins, setTimeoutMins] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => { (async () => { try { const r = await api.getRoles(guildId); setRoles(r.roles || []) } catch (e) { logger.debug('Caught error:', e?.message || e); } })() }, [guildId])

  const toggleRole = (id: string) => {
    setSelectedRoles(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const saveNickname = async () => {
    setLoading(true)
    try { await api.setMemberNickname(guildId, member.id, nick); toast({ type:'success', title:'Nickname atualizado' }); onChanged() } catch (e:any) { toast({ type:'error', title:'Falha ao atualizar nickname', description:e?.message }) } finally { setLoading(false) }
  }
  const saveRoles = async () => {
    setLoading(true)
    try {
      const current = new Set<string>(Array.isArray(member?.roles) ? (member.roles as string[]) : [])
      const next = selectedRoles
      const add = Array.from(next).filter(id => !current.has(id))
      const remove = Array.from(current).filter((id: string) => !next.has(id))
      const response = await api.updateMemberRoles(guildId, member.id, { add, remove })

      // Update local state with the successfully applied changes from backend
      if (response?.details) {
        const actuallyAdded = response.details.added || []
        const actuallyRemoved = response.details.removed || []

        setSelectedRoles(prev => {
          const updated = new Set(prev)
          actuallyAdded.forEach((roleId: string) => updated.add(roleId))
          actuallyRemoved.forEach((roleId: string) => updated.delete(roleId))
          return updated
        })
      }

      toast({ type:'success', title:'Cargos atualizados' })
      onChanged()
    } catch (e:any) { toast({ type:'error', title:'Falha ao atualizar cargos', description:e?.message }) }
    finally { setLoading(false) }
  }
  const applyTimeout = async () => {
    if (!(timeoutMins > 0)) { toast({ type:'info', title:'Tempo inválido' }); return }
    if (!confirm(`Aplicar timeout de ${timeoutMins} minutos?`)) return
    setLoading(true)
    try { await api.timeoutMember(guildId, member.id, Math.round(timeoutMins*60)); toast({ type:'success', title:'Timeout aplicado' }); onChanged() } catch (e:any) { toast({ type:'error', title:'Falha ao aplicar timeout', description:e?.message }) } finally { setLoading(false) }
  }
  const kick = async () => {
    if (!confirm('Expulsar este membro?')) return
    setLoading(true)
    try { await api.kickMember(guildId, member.id); toast({ type:'success', title:'Membro expulso' }); onChanged() } catch (e:any) { toast({ type:'error', title:'Falha ao expulsar', description:e?.message }) } finally { setLoading(false) }
  }
  const ban = async () => {
    if (!confirm('Banir este membro?')) return
    setLoading(true)
    try { await api.banMember(guildId, member.id, { deleteMessageSeconds: 3600 }); toast({ type:'success', title:'Membro banido' }); onChanged() } catch (e:any) { toast({ type:'error', title:'Falha ao banir', description:e?.message }) } finally { setLoading(false) }
  }

  const roleList = useMemo(() => roles.sort((a,b)=> a.name.localeCompare(b.name)), [roles])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Gerir membro">
      <div className="w-[min(96vw,720px)] rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div>
            <div className="text-sm text-neutral-400">Gerir</div>
            <div className="text-lg font-semibold">{member?.nick ? `${member.nick} (${member.username}#${member.discriminator})` : `${member.username}#${member.discriminator}`}</div>
          </div>
          <button type="button" onClick={onClose} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Fechar</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <section className="card p-3">
            <div className="text-sm font-medium mb-2">Nickname</div>
            <div className="flex items-center gap-2">
              <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={nick} onChange={e=> setNick(e.target.value)} placeholder="Sem nickname" />
              <button type="button" onClick={saveNickname} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" disabled={loading}>Guardar</button>
            </div>
          </section>
          <section className="card p-3">
            <div className="text-sm font-medium mb-2">Timeout</div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} className="w-32 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={timeoutMins} onChange={e=> setTimeoutMins(parseInt(e.target.value||'0',10))} aria-label="Minutos" />
              <span className="text-sm">min</span>
              <button type="button" onClick={applyTimeout} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" disabled={loading}>Aplicar</button>
            </div>
          </section>
          <section className="card p-3 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Cargos</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=> setSelectedRoles(new Set())} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Limpar</button>
                <button type="button" onClick={saveRoles} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" disabled={loading}>Guardar</button>
              </div>
            </div>
            <div className="max-h-60 overflow-auto grid grid-cols-2 gap-2">
              {roleList.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedRoles.has(r.id)} onChange={()=> toggleRole(r.id)} />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="card p-3">
            <div className="text-sm font-medium mb-2">Ações</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={kick} className="px-3 py-1.5 rounded bg-amber-600/30 border border-amber-700/60 hover:bg-amber-600/40" disabled={loading}>Kick</button>
              <button type="button" onClick={ban} className="px-3 py-1.5 rounded bg-rose-600/40 hover:bg-rose-600/50" disabled={loading}>Ban</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
