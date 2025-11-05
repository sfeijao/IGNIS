"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

type Tag = { id: string; name: string; prefix: string; color?: string; icon?: string; roleIds?: string[] }
type Role = { id: string; name: string; manageable?: boolean }

export default function QuickTagsManager() {
  const guildId = getGuildId()
  const { t } = useI18n()
  const { toast } = useToast()
  const [tags, setTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState<Tag | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyTagId, setApplyTagId] = useState<string>('')
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<Array<{ id: string; username: string; discriminator: string; nick?: string; manageable?: boolean }>>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [expireSeconds, setExpireSeconds] = useState<number | ''>('')

  const filtered = useMemo(() => tags.filter(t => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.prefix.toLowerCase().includes(q.toLowerCase())), [tags, q])

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await api.getTags(guildId)
      setTags(res.tags || [])
      // Load roles for optional association
      try {
        const r = await api.getRoles(guildId)
        const list: Role[] = (r.roles || r || []).map((x:any)=> ({ id: x.id, name: x.name, manageable: x.manageable }))
        setRoles(list)
      } catch { setRoles([]) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  const startNew = () => setEditing({ id: '', name: '', prefix: '', color: '', icon: '', roleIds: [] })

  function normalizeHexColor(input?: string) {
    const v = (input || '').trim();
    if (!v) return '';
    const m3 = v.match(/^#?([0-9a-fA-F]{3})$/);
    const m6 = v.match(/^#?([0-9a-fA-F]{6})$/);
    if (m3) {
      const [r, g, b] = m3[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (m6) return `#${m6[1].toLowerCase()}`;
    return ''; // invalid -> clear it
  }

  const save = async () => {
    if (!guildId || !editing) return
    const name = (editing.name || '').trim()
    const prefix = (editing.prefix || '').trim()
    if (!name || !prefix) {
      toast({ type: 'error', title: t('common.saveFailed') || 'Falha ao guardar', description: t('tags.validation.namePrefix') || 'Nome e prefixo são obrigatórios.' })
      return
    }
    const color = normalizeHexColor(editing.color)
    const icon = (editing.icon || '').slice(0, 32)
    const roleIds = Array.isArray(editing.roleIds) ? editing.roleIds.map(String).filter(Boolean).slice(0, 20) : []
    const payload = { id: editing.id || undefined, name, prefix, color, icon, roleIds }
    setLoading(true)
    try {
      await api.upsertTag(guildId, payload)
      setEditing(null)
      await load()
    } catch (e: any) {
      toast({ type: 'error', title: t('common.saveFailed') || 'Falha ao guardar', description: e?.message || 'Erro desconhecido' })
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!guildId) return
    if (!confirm(t('tags.remove.confirm') || 'Remover tag?')) return
    setLoading(true)
    try {
      await api.deleteTag(guildId, id)
      await load()
    } finally { setLoading(false) }
  }

  const openApply = async (id: string) => {
    setApplyTagId(id)
    setApplyOpen(true)
    setSelectedUserIds(new Set())
    setMemberQuery('')
    if (!guildId) return
    try {
      const res = await api.getMembers(guildId, { limit: 50 })
      setMembers(res.members || res || [])
    } catch { setMembers([]) }
  }

  const searchMembers = async () => {
    if (!guildId) return
    try {
      const res = await api.getMembers(guildId, { q: memberQuery, limit: 50, refresh: true })
      setMembers(res.members || res || [])
    } catch { setMembers([]) }
  }

  const toggleUser = (uid: string) => setSelectedUserIds(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })

  const apply = async () => {
    if (!guildId || !applyTagId || selectedUserIds.size === 0) return
    setLoading(true)
    try {
      const res = await api.applyTag(guildId, { tagId: applyTagId, userIds: Array.from(selectedUserIds), expireSeconds: typeof expireSeconds === 'number' ? expireSeconds : undefined })
      try {
        const results = Array.isArray(res?.results) ? res.results : []
        const ok = results.filter((r:any)=> r?.ok).length
        const rolesAdded = results.reduce((acc:number, r:any)=> acc + (Array.isArray(r?.addedRoles) ? r.addedRoles.length : (r?.roleAdded ? 1 : 0)), 0)
        toast({ type: 'success', title: t('tags.apply.done') || 'Tag applied', description: `${ok} ${t('guild.members') || 'members'}; ${rolesAdded} ${t('guild.roles') || 'roles'}` })
      } catch {}
      setApplyOpen(false)
      setSelectedUserIds(new Set())
    } catch (e: any) {
      toast({ type: 'error', title: t('common.saveFailed') || 'Failed', description: e?.message })
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="md:w-64">
          <label className="text-xs text-neutral-400">{t('tags.search') || 'Pesquisar'}</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={q} onChange={e=> setQ(e.target.value)} placeholder={t('tags.search.placeholder') || 'Procurar por nome/prefixo'} />
        </div>
  <button type="button" onClick={startNew} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50">{t('tags.new') || 'Nova tag'}</button>
  <button type="button" onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={loading}>{t('common.refresh') || 'Atualizar'}</button>
      </div>

      {editing && (
        <div className="card p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs text-neutral-400">{t('tags.name') || 'Nome'}</label>
            <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editing.name} onChange={e=> setEditing({ ...editing, name: e.target.value })} placeholder="Owner" />
          </div>
          <div>
            <label className="text-xs text-neutral-400">{t('tags.prefix') || 'Prefixo'}</label>
            <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editing.prefix} onChange={e=> setEditing({ ...editing, prefix: e.target.value })} placeholder="Owner | " />
          </div>
          <div>
            <label className="text-xs text-neutral-400">{t('tags.color') || 'Cor'}</label>
            <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editing.color||''} onChange={e=> setEditing({ ...editing, color: e.target.value })} placeholder="#a855f7" />
          </div>
          <div>
            <label className="text-xs text-neutral-400">{t('tags.icon') || 'Ícone'}</label>
            <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editing.icon||''} onChange={e=> setEditing({ ...editing, icon: e.target.value })} placeholder="⭐" />
          </div>
          <div>
            <label htmlFor="quicktag-roles" className="text-xs text-neutral-400">{t('tags.roles') || t('tags.role') || 'Cargos (opcional)'}</label>
            <select
              id="quicktag-roles"
              title={t('tags.roles') || 'Cargos (opcional)'}
              multiple
              className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 h-28"
              value={Array.isArray(editing.roleIds) ? editing.roleIds : []}
              onChange={e=> {
                const selected = Array.from(e.target.selectedOptions).map(o => o.value).filter(Boolean)
                setEditing(prev => ({ ...(prev as Tag), roleIds: selected }))
              }}
            >
              {roles.map(r => (
                <option key={r.id} value={r.id} disabled={r.manageable===false}>{`@${r.name}`}{r.manageable===false ? ' (não gerenciável)' : ''}</option>
              ))}
            </select>
            <div className="text-[11px] text-neutral-500 mt-1">{t('tags.roles.hint') || 'Note: roles at/above the bot’s highest role or managed roles are skipped automatically.'}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={loading}>{t('common.save') || 'Guardar'}</button>
            <button type="button" onClick={()=> setEditing(null)} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('common.cancel') || 'Cancelar'}</button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">{t('common.loading') || 'A carregar…'}</div>}
          {filtered.map(tg => (
            <div key={tg.id} className="p-4 flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center" title={tg.icon || ''}>{tg.icon || '🏷️'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{tg.name} <span className="text-neutral-500">({tg.prefix})</span></div>
              </div>
              <button type="button" className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" onClick={()=> setEditing(tg)} title="Editar">{t('common.edit') || 'Editar'}</button>
              <button type="button" className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" onClick={()=> openApply(tg.id)} title="Aplicar">{t('tags.apply') || 'Aplicar'}</button>
              <button type="button" className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500" onClick={()=> remove(tg.id)} title="Remover">{t('common.remove') || 'Remover'}</button>
            </div>
          ))}
        </div>
      </div>

      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t('tags.apply.modalTitle') || 'Aplicar tag'}</div>
              <button type="button" onClick={()=> setApplyOpen(false)} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('common.close') || 'Fechar'}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-neutral-400">{t('tags.members.search') || 'Pesquisar membros'}</label>
                <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={memberQuery} onChange={e=> setMemberQuery(e.target.value)} placeholder="nome ou id" />
              </div>
              <button type="button" onClick={searchMembers} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('common.search') || 'Pesquisar'}</button>
              <div>
                <label className="text-xs text-neutral-400">{t('tags.expireSeconds') || 'Expiração (segundos, opcional)'}</label>
                <input type="number" className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={expireSeconds as any} onChange={e=> setExpireSeconds(e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="3600" />
              </div>
            </div>
            <div className="h-64 overflow-auto border border-neutral-800 rounded">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-3 p-2 border-b border-neutral-800">
                  <input type="checkbox" checked={selectedUserIds.has(m.id)} onChange={()=> toggleUser(m.id)} />
                  <span className="flex-1 min-w-0 text-neutral-200 truncate">{m.nick ? `${m.nick} (${m.username}#${m.discriminator})` : `${m.username}#${m.discriminator}`}</span>
                  <span className="text-xs text-neutral-500">{m.id}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={apply} className="px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={selectedUserIds.size===0}>{t('tags.applyNow') || 'Aplicar agora'}</button>
              <button type="button" onClick={()=> setApplyOpen(false)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('common.cancel') || 'Cancelar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
