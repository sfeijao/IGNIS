"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'
import { useToast } from './Toaster'
import { PERMISSION_BITS, PERMISSION_KEYS, useI18n } from '@/lib/i18n'

type Role = { id: string; name: string; color?: string; position?: number; managed?: boolean; mentionable?: boolean }
type RoleDetails = { id: string; name: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string }

export default function RolesManager() {
  const guildId = getGuildId()
  const { toast } = useToast()
  const { t, lang, setLang } = useI18n()
  const [roles, setRoles] = useState<Role[]>([])
  const [name, setName] = useState('novo-cargo')
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string|null>(null)
  const [dragOverId, setDragOverId] = useState<string|null>(null)
  const [dragOverPos, setDragOverPos] = useState<'above'|'below'|null>(null)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [details, setDetails] = useState<RoleDetails|null>(null)
  const [permSet, setPermSet] = useState<Set<string>>(new Set())
  const [permQuery, setPermQuery] = useState<string>('')

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getRoles(guildId)
      setRoles(res.roles || [])
    } catch (e: any) { setError(e?.message || t('roles.load.failed')) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  useEffect(() => {
    if (!guildId || !selectedId) { setDetails(null); setPermSet(new Set()); return }
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.getRole(guildId, selectedId)
        if (cancelled) return
        const r = d.role as RoleDetails
        setDetails(r)
        // decode permissions bitfield if present into keys
        if (r.permissions) {
          try {
            const bf = BigInt(r.permissions)
            const next = new Set<string>()
            for (const { key } of PERMISSION_KEYS) {
              const bit = PERMISSION_BITS[key]
              if (bit && (bf & bit) === bit) next.add(key)
            }
            setPermSet(next)
          } catch {
            setPermSet(new Set())
          }
        } else {
          setPermSet(new Set())
        }
      } catch (e:any) {
        toast({ type:'error', title: t('roles.role.load.failed'), description: e?.message })
      }
    })()
    return () => { cancelled = true }
  }, [guildId, selectedId])

  const create = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, color, hoist: false, mentionable: false })
      })
      await load()
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!guildId) return
    if (!confirm(t('roles.remove.confirm'))) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/roles/${id}`, { method: 'DELETE', credentials: 'include' })
      await load()
    } finally { setLoading(false) }
  }

  const move = async (id: string, direction: 'up'|'down') => {
    if (!guildId) return
    setLoading(true)
    try {
      await api.moveRole(guildId, id, { direction, delta: 1 })
      await load()
    } finally { setLoading(false) }
  }

  const onDragStart = (id:string) => { setDragId(id); }
  const onDragEnd = () => { setDragId(null); setDragOverId(null); setDragOverPos(null) }
  const onDragOverRow = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    if (!dragId) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const pos: 'above'|'below' = y < rect.height / 2 ? 'above' : 'below'
    setDragOverId(targetId)
    setDragOverPos(pos)
  }
  const onDropOn = async (targetId:string) => {
    if (!guildId || !dragId || dragId === targetId) return
    const from = roles.findIndex(r=> r.id === dragId)
    let to = roles.findIndex(r=> r.id === targetId)
    if (dragOverPos === 'below') to = to + 1
    if (from < 0 || to < 0) return
    const direction = (to < from) ? 'up' : 'down'
    const delta = Math.abs(to - from)
    setLoading(true)
    try { await api.moveRole(guildId, dragId, { direction, delta }); await load(); } catch (e:any) { toast({ type:'error', title: t('roles.move.failed'), description:e?.message }) } finally { setLoading(false); onDragEnd() }
  }

  const togglePerm = (key:string) => {
    setPermSet(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }
  const saveProps = async () => {
    if (!guildId || !selectedId || !details) return
    setLoading(true)
    try {
      const payload: any = { name: details.name, color: details.color, hoist: !!details.hoist, mentionable: !!details.mentionable }
      if (permSet.size > 0) payload.permissions = Array.from(permSet)
      await api.updateRole(guildId, selectedId, payload)
      toast({ type:'success', title:'Cargo atualizado' })
      await load()
    } catch(e:any){ toast({ type:'error', title:'Falha ao atualizar cargo', description:e?.message }) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">{t('roles.selectGuild')}</div>}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="role-name" className="text-xs text-neutral-400">{t('roles.name')}</label>
          <input id="role-name" className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={name} onChange={e=> setName(e.target.value)} placeholder={t('roles.name')} title={t('roles.name')} />
        </div>
        <div>
          <label htmlFor="role-color" className="text-xs text-neutral-400">{t('roles.color')}</label>
          <input id="role-color" className="mt-1 w-40 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={color} onChange={e=> setColor(e.target.value)} placeholder="#ffffff" title={t('roles.color')} />
        </div>
  <button type="button" onClick={create} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={!guildId || loading}>{t('roles.create')}</button>
  <button type="button" onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={!guildId || loading}>{t('roles.refresh')}</button>
        <div className="ml-auto flex items-end gap-2">
          <label className="text-xs text-neutral-400">Lang</label>
          <select className="mt-5 bg-neutral-900 border border-neutral-700 rounded px-2 py-2 text-sm" value={lang} onChange={e=> setLang(e.target.value as any)} aria-label="Language">
            <option value="pt">PT</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">{t('roles.loading')}</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {roles.map(r => (
            <div
              key={r.id}
              onDragOver={(e)=> onDragOverRow(e, r.id)}
              onDrop={()=> onDropOn(r.id)}
              className={`relative p-4 flex items-center gap-3 ${selectedId===r.id? 'bg-neutral-800/40' : ''}`}
              onClick={()=> setSelectedId(r.id)}
            >
              {/* Drop indicators */}
              {dragOverId===r.id && dragOverPos==='above' && <div className="absolute left-0 right-0 top-0 h-0.5 bg-brand-600" />}
              {dragOverId===r.id && dragOverPos==='below' && <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-600" />}
              {/* Drag handle */}
              <button type="button"
                className="cursor-grab p-1 rounded hover:bg-neutral-800 border border-transparent hover:border-neutral-700"
                draggable
                onDragStart={()=> onDragStart(r.id)}
                onDragEnd={onDragEnd}
                onClick={(e)=> e.stopPropagation()}
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 3h2v2H4V3zm6 0h2v2h-2V3zM4 7h2v2H4V7zm6 0h2v2h-2V7zM4 11h2v2H4v-2zm6 0h2v2h-2v-2z" fill="#aaa"/>
                </svg>
              </button>
              {/* Color dot using SVG to avoid inline styles */}
              <svg width="16" height="16" aria-hidden="true" className="shrink-0">
                <circle cx="8" cy="8" r="7" fill={r.color || '#888'} stroke="#444" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.id}</div>
              </div>
              <button type="button" onClick={(e)=> { e.stopPropagation(); move(r.id, 'up') }} aria-label={`${t('roles.up')} ${r.name}`} title={t('roles.up')} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('roles.up')}</button>
              <button type="button" onClick={(e)=> { e.stopPropagation(); move(r.id, 'down') }} aria-label={`${t('roles.down')} ${r.name}`} title={t('roles.down')} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('roles.down')}</button>
              {!r.managed && <button type="button" onClick={(e)=> { e.stopPropagation(); remove(r.id) }} aria-label={`${t('roles.remove')} ${r.name}`} title={t('roles.remove')} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500">{t('roles.remove')}</button>}
            </div>
          ))}
          </div>
        </div>
        <div className="card p-4">
          {!selectedId && <div className="text-sm text-neutral-400">{t('roles.selectToEdit')}</div>}
          {selectedId && details && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400">{t('roles.name')}</label>
                  <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={details.name||''} onChange={e=> setDetails({ ...details, name: e.target.value })} placeholder={t('roles.name')} title={t('roles.name')} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400">{t('roles.color')}</label>
                  <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={details.color||''} onChange={e=> setDetails({ ...details, color: e.target.value })} placeholder="#ffffff" title={t('roles.color')} />
                </div>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!details.hoist} onChange={e=> setDetails({ ...details, hoist: e.target.checked })} /> {t('roles.showSeparately')}</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!details.mentionable} onChange={e=> setDetails({ ...details, mentionable: e.target.checked })} /> {t('roles.mentionable')}</label>
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium">{t('roles.permissions')}</div>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" onClick={()=> setPermSet(new Set(PERMISSION_KEYS.map(p=>p.key)))}>{t('roles.permissions.selectAll')}</button>
                    <button type="button" className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" onClick={()=> setPermSet(new Set())}>{t('roles.permissions.clearAll')}</button>
                  </div>
                </div>
                <input
                  className="mb-2 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                  placeholder={t('roles.permissions.search')}
                  value={permQuery}
                  onChange={e=> setPermQuery(e.target.value)}
                  aria-label={t('roles.permissions.search')}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-auto pr-1">
                  {PERMISSION_KEYS.filter(p => {
                    if (!permQuery) return true
                    const q = permQuery.toLowerCase()
                    const label = (t(`perm.${p.key}`) || p.key).toLowerCase()
                    return label.includes(q) || p.key.toLowerCase().includes(q)
                  }).map(p => (
                    <label key={p.key} className={`inline-flex items-center gap-2 text-sm ${p.danger? 'text-amber-300' : ''}`} title={p.key}>
                      <input type="checkbox" checked={permSet.has(p.key)} onChange={()=> togglePerm(p.key)} /> {t(`perm.${p.key}`)}
                    </label>
                  ))}
                </div>
                <div className="text-xs text-neutral-500 mt-2">{t('roles.permissions.note')}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveProps} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" disabled={loading}>{t('roles.save')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
