"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useGuildId } from '@/lib/guild'
import { useToast } from './Toaster'
import { PERMISSION_BITS, PERMISSION_KEYS, useI18n } from '@/lib/i18n'

type Role = { id: string; name: string; color?: string; position?: number; managed?: boolean; mentionable?: boolean }
type RoleDetails = { id: string; name: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string }

export default function RolesManager() {
  const guildId = useGuildId()
  const { toast } = useToast()
  const { t, lang, setLang } = useI18n()
  const [roles, setRoles] = useState<Role[]>([])
  const [name, setName] = useState('novo-cargo')
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
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
    } catch (e: any) { setError((e instanceof Error ? e.message : String(e)) || t('roles.load.failed')) } finally { setLoading(false) }
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
        toast({ type:'error', title: t('roles.role.load.failed'), description: (e instanceof Error ? e.message : String(e)) })
      }
    })()
    return () => { cancelled = true }
  }, [guildId, selectedId])

  const create = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, color, hoist: false, mentionable: false })
      })
      if (res.ok) { toast({ type:'success', title: t('roles.updated') }) } else { toast({ type:'error', title: t('common.saveFailed') }) }
      await load()
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!guildId) return
    if (!confirm(t('roles.remove.confirm'))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/roles/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) toast({ type:'success', title: t('roles.updated') })
      else toast({ type:'error', title: t('common.saveFailed') })
      await load()
    } finally { setLoading(false) }
  }

  const move = async (id: string, direction: 'up'|'down') => {
    if (!guildId) return
    setLoading(true)
    try {
      await api.moveRole(guildId, id, { direction, delta: 1 })
      toast({ type:'success', title: t('roles.updated') })
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
    try { await api.moveRole(guildId, dragId, { direction, delta }); await load(); } catch (e:any) { toast({ type:'error', title: t('roles.move.failed'), description:(e instanceof Error ? e.message : String(e)) }) } finally { setLoading(false); onDragEnd() }
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
    } catch(e:any){ toast({ type:'error', title:'Falha ao atualizar cargo', description:(e instanceof Error ? e.message : String(e)) }) }
    finally { setLoading(false) }
  }

  const totalRoles = roles.length
  const managedRoles = roles.filter(r => r.managed).length
  const hoistedRoles = roles.filter(r => details?.id === r.id ? details.hoist : false).length

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-pink-600/20 to-rose-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎭</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                {t('nav.roles')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Manage server roles and permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              className="bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-pink-500"
              value={lang}
              onChange={e=> setLang(e.target.value as any)}
              aria-label="Language"
            >
              <option value="pt">🇵🇹 PT</option>
              <option value="en">🇬🇧 EN</option>
            </select>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-600 peer-checked:to-rose-600"></div>
            </label>
          </div>
        </div>
      </div>

      {!guildId && (
        <div className="bg-yellow-600/20 backdrop-blur-xl border border-yellow-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <span>{t('roles.selectGuild')}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-600/20 to-rose-600/20 rounded-lg flex items-center justify-center text-2xl">
              🎭
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalRoles}</div>
              <div className="text-sm text-gray-400">Total Roles</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-lg flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{managedRoles}</div>
              <div className="text-sm text-gray-400">Managed Roles</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
              {selectedId ? '✏️' : '📋'}
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400">{selectedId ? 'Editing' : 'None'}</div>
              <div className="text-sm text-gray-400">Selected Role</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Role */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">➕</span>
          <h3 className="text-lg font-semibold text-white">Create New Role</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('roles.name')}</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              value={name}
              onChange={e=> setName(e.target.value)}
              placeholder={t('roles.name')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('roles.color')}</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              value={color}
              onChange={e=> setColor(e.target.value)}
              placeholder="#ffffff"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={create}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!guildId || loading || !enabled}
            >
              {t('roles.create')}
            </button>
            <button
              type="button"
              onClick={load}
              className="py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all duration-200"
              disabled={!guildId || loading}
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 backdrop-blur-xl border border-red-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400">
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Roles List & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roles List */}
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-semibold text-white">Role Hierarchy</h3>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-gray-400">{t('roles.loading')}</div>
              </div>
            )}
            {!loading && roles.map(r => (
              <div
                key={r.id}
                onDragOver={(e)=> onDragOverRow(e, r.id)}
                onDrop={()=> onDropOn(r.id)}
                className={`relative bg-gray-900/50 border ${selectedId===r.id ? 'border-pink-600' : 'border-gray-700'} hover:border-pink-600/50 rounded-xl p-4 transition-all duration-200 cursor-pointer`}
                onClick={()=> setSelectedId(r.id)}
              >
                {dragOverId===r.id && dragOverPos==='above' && <div className="absolute left-0 right-0 top-0 h-1 bg-pink-600 rounded-t-xl" />}
                {dragOverId===r.id && dragOverPos==='below' && <div className="absolute left-0 right-0 bottom-0 h-1 bg-pink-600 rounded-b-xl" />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="cursor-grab p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    draggable
                    onDragStart={()=> onDragStart(r.id)}
                    onDragEnd={onDragEnd}
                    onClick={(e)=> e.stopPropagation()}
                    aria-label="Drag to reorder"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 3h2v2H4V3zm6 0h2v2h-2V3zM4 7h2v2H4V7zm6 0h2v2h-2V7zM4 11h2v2H4v-2zm6 0h2v2h-2v-2z" fill="#aaa"/>
                    </svg>
                  </button>

                  <svg width="20" height="20" className="shrink-0">
                    <circle cx="10" cy="10" r="9" fill={r.color || '#888'} stroke="#444" strokeWidth="1" />
                  </svg>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{r.id}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e)=> { e.stopPropagation(); move(r.id, 'up') }}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      disabled={!enabled}
                    >
                      ⬆️
                    </button>
                    <button
                      type="button"
                      onClick={(e)=> { e.stopPropagation(); move(r.id, 'down') }}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      disabled={!enabled}
                    >
                      ⬇️
                    </button>
                    {!r.managed && (
                      <button
                        type="button"
                        onClick={(e)=> { e.stopPropagation(); remove(r.id) }}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                        disabled={!enabled}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Editor */}
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">✏️</span>
            <h3 className="text-lg font-semibold text-white">Role Editor</h3>
          </div>

          {!selectedId && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👈</div>
              <div className="text-gray-400">{t('roles.selectToEdit')}</div>
            </div>
          )}

          {selectedId && details && (
            <div className="space-y-6">
              {/* Basic Properties */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">{t('roles.name')}</label>
                    <input
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      value={details.name||''}
                      onChange={e=> setDetails({ ...details, name: e.target.value })}
                      placeholder={t('roles.name')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">{t('roles.color')}</label>
                    <input
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      value={details.color||''}
                      onChange={e=> setDetails({ ...details, color: e.target.value })}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-700 rounded-xl cursor-pointer hover:border-pink-600/50 transition-all">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded bg-gray-900/50 border-gray-700 text-pink-600 focus:ring-2 focus:ring-pink-500"
                      checked={!!details.hoist}
                      onChange={e=> setDetails({ ...details, hoist: e.target.checked })}
                    />
                    <span className="text-sm text-gray-300">{t('roles.showSeparately')}</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-700 rounded-xl cursor-pointer hover:border-pink-600/50 transition-all">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded bg-gray-900/50 border-gray-700 text-pink-600 focus:ring-2 focus:ring-pink-500"
                      checked={!!details.mentionable}
                      onChange={e=> setDetails({ ...details, mentionable: e.target.checked })}
                    />
                    <span className="text-sm text-gray-300">{t('roles.mentionable')}</span>
                  </label>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">{t('roles.permissions')}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      onClick={()=> setPermSet(new Set(PERMISSION_KEYS.map(p=>p.key)))}
                    >
                      {t('roles.permissions.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      onClick={()=> setPermSet(new Set())}
                    >
                      {t('roles.permissions.clearAll')}
                    </button>
                  </div>
                </div>

                <input
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder={t('roles.permissions.search')}
                  value={permQuery}
                  onChange={e=> setPermQuery(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                  {PERMISSION_KEYS.filter(p => {
                    if (!permQuery) return true
                    const q = permQuery.toLowerCase()
                    const label = (t(`perm.${p.key}`) || p.key).toLowerCase()
                    return label.includes(q) || p.key.toLowerCase().includes(q)
                  }).map(p => (
                    <label
                      key={p.key}
                      className={`flex items-center gap-2 p-2 bg-gray-900/50 border border-gray-700 rounded-lg cursor-pointer hover:border-pink-600/50 transition-all ${p.danger ? 'text-amber-300' : 'text-gray-300'}`}
                      title={p.key}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded bg-gray-900/50 border-gray-700 text-pink-600 focus:ring-2 focus:ring-pink-500"
                        checked={permSet.has(p.key)}
                        onChange={()=> togglePerm(p.key)}
                      />
                      <span className="text-xs">{t(`perm.${p.key}`)}</span>
                    </label>
                  ))}
                </div>

                <div className="text-xs text-gray-500 italic">{t('roles.permissions.note')}</div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={saveProps}
                className="w-full py-3 px-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !enabled}
              >
                {t('roles.save')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
