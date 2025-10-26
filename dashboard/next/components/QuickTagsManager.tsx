"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'

type Tag = { key: string; content: string }

export default function QuickTagsManager() {
  const guildId = getGuildId()
  const [tags, setTags] = useState<Tag[]>([])
  const [key, setKey] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/quick-tags`, { credentials: 'include' })
      if (res.ok) { const data = await res.json(); setTags(data.tags || data || []) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  const add = async () => {
    if (!guildId || !key || !content) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/quick-tags`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify({ key, content }) })
      setKey(''); setContent(''); await load()
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-400">Chave</label>
          <input className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={key} onChange={e=> setKey(e.target.value)} placeholder="ex: regras" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs text-neutral-400">Conteúdo</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={content} onChange={e=> setContent(e.target.value)} placeholder="Mensagem rápida" />
        </div>
        <button onClick={add} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={!guildId || !key || !content || loading}>Adicionar</button>
        <button onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={loading}>Atualizar</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">A carregar…</div>}
          {tags.map(t => (
            <div key={t.key} className="p-4 flex items-center gap-3">
              <div className="font-mono text-xs text-neutral-500">:{t.key}</div>
              <div className="flex-1 min-w-0 text-neutral-200 truncate">{t.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
