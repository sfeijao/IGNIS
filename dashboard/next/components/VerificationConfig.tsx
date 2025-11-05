"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/apiClient'

type VerificationConfig = {
  mode?: 'easy'|'medium'|'hard'
  method?: 'button'|'image'|'reaction'|'form'
  cooldownSeconds?: number
  logFails?: boolean
  logFailRetention?: number
  verifiedRoleId?: string
  unverifiedRoleId?: string
  form?: { questions: Array<{ id?: string; label: string; type: string; required?: boolean; options?: string[] }> }
  panelDefaults?: { template?: 'minimal'|'rich'; title?: string; description?: string; buttonLabel?: string; color?: string }
}
type Channel = { id: string; name: string; type?: string }
type Role = { id: string; name: string }

// Helpers – keep consistent with other components
const isTextChannel = (ch: Channel) => {
  const t = String(ch.type || '').toLowerCase()
  return t.includes('text') || t.includes('announcement')
}
const channelTypeLabel = (ch: Channel | string | undefined) => {
  const t = typeof ch === 'string' ? ch : (ch?.type || '')
  switch (String(t).toLowerCase()) {
    case 'guild_text':
    case 'text': return 'Text'
    case 'guild_announcement':
    case 'announcement': return 'Announcement'
    case 'guild_voice':
    case 'voice': return 'Voice'
    case 'guild_category':
    case 'category': return 'Category'
    default: return 'Channel'
  }
}

export default function VerificationConfig() {
  const guildId = getGuildId()
  const [cfg, setCfg] = useState<VerificationConfig>({ mode: 'easy', method: 'button', cooldownSeconds: 0, logFails: false })
  const [panelDefaults, setPanelDefaults] = useState<NonNullable<VerificationConfig['panelDefaults']>>({ template: 'minimal', title: '', description: '', buttonLabel: '', color: '#7C3AED' })
  const [panelChannelId, setPanelChannelId] = useState<string>('')
  const [useSavedDefaults, setUseSavedDefaults] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<'idle'|'saving'|'ok'|'err'>('idle')
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [testing, setTesting] = useState<'idle'|'sending'|'ok'|'err'>('idle')
  const { t } = useI18n()

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    ;(async () => {
      try {
        const res = await fetch(`/api/guild/${guildId}/verification/config`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const v = data?.config || data || {}
          if (!aborted) {
            setCfg({
              mode: v.mode || 'easy',
              method: v.method || 'button',
              cooldownSeconds: Number(v.cooldownSeconds || 0),
              logFails: !!v.logFails,
              logFailRetention: v.logFailRetention || (v.logFails ? 7 : undefined),
              verifiedRoleId: v.verifiedRoleId || '',
              unverifiedRoleId: v.unverifiedRoleId || '',
              form: v.form && v.form.questions ? { questions: v.form.questions } : undefined,
            })
            const pd = (v.panelDefaults || {})
            setPanelDefaults({
              template: ['minimal','rich'].includes(pd.template) ? pd.template : 'minimal',
              title: pd.title || '',
              description: pd.description || '',
              buttonLabel: pd.buttonLabel || '',
              color: pd.color || '#7C3AED'
            })
          }
        }
      } catch {}
      try {
        const list = await api.getChannels(guildId)
        if (!aborted) setChannels(list.channels || list || [])
      } catch {}
      try {
        const rs = await api.getRoles(guildId)
        if (!aborted) setRoles(rs.roles || rs || [])
      } catch {}
    })()
    return () => { aborted = true }
  }, [guildId])

  const selectableChannels = useMemo(() => channels.filter(isTextChannel), [channels])

  const save = async () => {
    if (!guildId) return
    setLoading(true); setSaved('saving')
    try {
      const payload: VerificationConfig = {
        mode: cfg.mode || 'easy',
        method: cfg.method || 'button',
        cooldownSeconds: Math.max(0, Math.min(3600, Number(cfg.cooldownSeconds || 0))),
        logFails: !!cfg.logFails,
        verifiedRoleId: cfg.verifiedRoleId || undefined,
        unverifiedRoleId: cfg.unverifiedRoleId || undefined,
      }
      if (payload.logFails) payload.logFailRetention = Math.max(1, Math.min(90, Number(cfg.logFailRetention || 7)))
      if (cfg.method === 'form' && cfg.form && Array.isArray(cfg.form.questions) && cfg.form.questions.length > 0) {
        payload.form = { questions: cfg.form.questions }
      }
      const res = await fetch(`/api/guild/${guildId}/verification/config`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      setSaved(res.ok ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  const saveDefaults = async () => {
    if (!guildId) return
    setLoading(true); setSaved('saving')
    try {
      const body = { panelDefaults: {
        template: panelDefaults.template,
        title: (panelDefaults.title || '').trim(),
        description: (panelDefaults.description || '').trim(),
        buttonLabel: (panelDefaults.buttonLabel || '').trim(),
        color: (panelDefaults.color || '').trim()
      }}
      const res = await fetch(`/api/guild/${guildId}/verification/config`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      setSaved(res.ok ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  const resetDefaults = async () => {
    if (!guildId) return
    setLoading(true); setSaved('saving')
    try {
      const res = await fetch(`/api/guild/${guildId}/verification/config`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify({ panelDefaults: { clear: true } }) })
      setSaved(res.ok ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  const createPanel = async () => {
    if (!guildId || !panelChannelId) return
    setLoading(true); setSaved('saving')
    try {
      const payload: any = { type: 'verification', channel_id: panelChannelId, theme: 'dark' }
      if (!useSavedDefaults) {
        payload.template = panelDefaults.template || 'minimal'
        payload.options = {
          title: (panelDefaults.title || '').trim() || undefined,
          description: (panelDefaults.description || '').trim() || undefined,
          buttonLabel: (panelDefaults.buttonLabel || '').trim() || undefined,
          color: (panelDefaults.color || '').trim() || undefined,
        }
      }
      const res = await api.createPanel(guildId, payload)
      setSaved(res?.success ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  const testPanel = async () => {
    if (!guildId) return
    setTesting('sending')
    try {
      const payload: any = { type: 'verification', dryRun: true, theme: 'dark' }
      if (!useSavedDefaults) {
        payload.template = panelDefaults.template || 'minimal'
        payload.options = {
          title: (panelDefaults.title || '').trim() || undefined,
          description: (panelDefaults.description || '').trim() || undefined,
          buttonLabel: (panelDefaults.buttonLabel || '').trim() || undefined,
          color: (panelDefaults.color || '').trim() || undefined,
        }
      }
      const res = await api.createPanel(guildId, payload)
      setTesting(res?.success ? 'ok' : 'err')
    } catch { setTesting('err') } finally { setTimeout(()=> setTesting('idle'), 2000) }
  }

  return (
    <div className="space-y-4">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">{t('verification.selectGuild')}</div>}

      {/* Core configuration */}
      <form className="card p-5 max-w-2xl space-y-4" onSubmit={(e)=>{ e.preventDefault(); save() }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.mode')}</label>
            <select title={t('verification.mode')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.mode} onChange={e=> setCfg(c=> ({ ...c, mode: e.target.value as any }))}>
              <option value="easy">{t('verification.mode.easy')}</option>
              <option value="medium">{t('verification.mode.medium')}</option>
              <option value="hard">{t('verification.mode.hard')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">{t('verification.method')}</label>
            <select title={t('verification.method')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.method} onChange={e=> setCfg(c=> ({ ...c, method: e.target.value as any }))}>
              <option value="button">{t('verification.method.button')}</option>
              <option value="image">{t('verification.method.image')}</option>
              <option value="reaction">{t('verification.method.reaction')}</option>
              <option value="form">{t('verification.method.form')}</option>
            </select>
            <p className="text-xs opacity-70 mt-1">
              {cfg.method === 'button' && t('verification.method.help.button')}
              {cfg.method === 'image' && t('verification.method.help.image')}
              {cfg.method === 'reaction' && t('verification.method.help.reaction')}
              {cfg.method === 'form' && t('verification.method.help.form')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.cooldownSeconds')}</label>
            <input title={t('verification.cooldownSeconds')} placeholder="0" type="number" min={0} max={3600} value={Number(cfg.cooldownSeconds||0)} onChange={e=> setCfg(c=> ({ ...c, cooldownSeconds: Math.max(0, Math.min(3600, parseInt(e.target.value||'0',10)||0)) }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="v-logfails" type="checkbox" checked={!!cfg.logFails} onChange={e=> setCfg(c => ({ ...c, logFails: e.target.checked }))} />
            <label htmlFor="v-logfails">{t('verification.logFails')}</label>
          </div>
        </div>
        {cfg.logFails && (
          <div>
            <label className="block text-sm mb-1">{t('verification.logFailRetention')}</label>
            <input title={t('verification.logFailRetention')} placeholder="7" type="number" min={1} max={90} value={Number(cfg.logFailRetention||7)} onChange={e=> setCfg(c=> ({ ...c, logFailRetention: Math.max(1, Math.min(90, parseInt(e.target.value||'7',10)||7)) }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 max-w-xs" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.verifiedRole')}</label>
            <select title={t('verification.verifiedRole')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.verifiedRoleId || ''} onChange={e=> setCfg(c=> ({ ...c, verifiedRoleId: e.target.value }))}>
              <option value="">—</option>
              {roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">{t('verification.unverifiedRole')}</label>
            <select title={t('verification.unverifiedRole')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.unverifiedRoleId || ''} onChange={e=> setCfg(c=> ({ ...c, unverifiedRoleId: e.target.value }))}>
              <option value="">—</option>
              {roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
          </div>
        </div>

        {/* Form builder (only for method=form) */}
        {cfg.method === 'form' && (
          <FormBuilder value={cfg.form?.questions || []} onChange={(questions)=> setCfg(c=> ({ ...c, form: { questions } }))} />
        )}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">{saved==='saving' ? t('verification.saving') : t('verification.save')}</button>
          {saved==='ok' && <span className="text-emerald-400 text-sm">{t('verification.saved')}</span>}
          {saved==='err' && <span className="text-rose-400 text-sm">{t('verification.saveFailed')}</span>}
        </div>
      </form>

      {/* Panel defaults */}
      <div className="card p-5 max-w-2xl space-y-4">
        <div className="text-lg font-semibold">{t('verification.panel.defaults')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.panel.template')}</label>
            <select title={t('verification.panel.template')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={panelDefaults.template} onChange={e=> setPanelDefaults(p=> ({ ...p, template: (e.target.value as any) }))}>
              <option value="minimal">{t('verification.panel.template.minimal')}</option>
              <option value="rich">{t('verification.panel.template.rich')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">{t('verification.panel.color')}</label>
            <input title={t('verification.panel.color')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={panelDefaults.color || ''} onChange={e=> setPanelDefaults(p=> ({ ...p, color: e.target.value }))} placeholder="#7C3AED" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.panel.title')}</label>
            <input title={t('verification.panel.title')} placeholder={t('verification.panel.title')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={panelDefaults.title || ''} onChange={e=> setPanelDefaults(p=> ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1">{t('verification.panel.buttonLabel')}</label>
            <input title={t('verification.panel.buttonLabel')} placeholder={t('verification.panel.buttonLabel')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={panelDefaults.buttonLabel || ''} onChange={e=> setPanelDefaults(p=> ({ ...p, buttonLabel: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">{t('verification.panel.description')}</label>
          <textarea title={t('verification.panel.description')} placeholder={t('verification.panel.description')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" rows={3} value={panelDefaults.description || ''} onChange={e=> setPanelDefaults(p=> ({ ...p, description: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveDefaults} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.panel.saveDefaults')}</button>
          <button type="button" onClick={resetDefaults} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.panel.resetDefaults')}</button>
        </div>
      </div>

      {/* Preview + Create panel */}
      <div className="card p-5 max-w-2xl space-y-4">
        <div className="text-lg font-semibold">{t('verification.panel.preview')}</div>
        <PanelPreview title={panelDefaults.title || ''} description={panelDefaults.description || ''} buttonLabel={panelDefaults.buttonLabel || t('verification.panel.buttonLabel')} color={panelDefaults.color || '#7C3AED'} hideButton={cfg.method === 'reaction'} />
      </div>

      {/* Create panel */}
      <div className="card p-5 max-w-2xl space-y-4">
        <div className="text-lg font-semibold">{t('verification.panel.create')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('verification.panel.channel')}</label>
            <select title={t('verification.panel.channel')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={panelChannelId} onChange={e=> setPanelChannelId(e.target.value)}>
              <option value="">—</option>
              {selectableChannels.map(ch => (<option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="useSavedDefaults" type="checkbox" checked={useSavedDefaults} onChange={e=> setUseSavedDefaults(e.target.checked)} />
            <label htmlFor="useSavedDefaults">{t('verification.panel.useSavedDefaults')}</label>
          </div>
        </div>
        <div>
          <button type="button" onClick={createPanel} disabled={!panelChannelId} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">
            {t('verification.panel.createButton')}
          </button>
          <button type="button" onClick={testPanel} className="ml-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">
            {t('verification.panel.test')}
          </button>
          {testing==='sending' && <span className="ml-2 text-sm opacity-70">{t('common.working')}</span>}
          {testing==='ok' && <span className="ml-2 text-sm text-emerald-400">{t('verification.panel.test.sent')}</span>}
          {testing==='err' && <span className="ml-2 text-sm text-rose-400">{t('verification.panel.test.fail')}</span>}
        </div>
      </div>
    </div>
  )
}

// --- FormBuilder subcomponent ---
function FormBuilder({ value, onChange }: { value: Array<{ id?: string; label: string; type: string; required?: boolean; options?: string[] }>; onChange: (q: any[]) => void }){
  const { t } = useI18n()
  const [questions, setQuestions] = useState<any[]>(() => Array.isArray(value) ? value.slice() : [])
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'short_text'|'long_text'|'yes_no'|'multiple_choice'|'dropdown'>('short_text')
  const [required, setRequired] = useState(false)
  const [optInput, setOptInput] = useState('')
  const [opts, setOpts] = useState<string[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => { setQuestions(Array.isArray(value) ? value.slice() : []) }, [value])
  useEffect(() => { onChange(questions) }, [questions])

  const resetForm = () => { setLabel(''); setType('short_text'); setRequired(false); setOptInput(''); setOpts([]); setEditing(null) }
  const addOption = () => { const v = (optInput||'').trim(); if(!v) return; if(opts.includes(v)) return; if(opts.length>=25) return; setOpts(o=> [...o, v]); setOptInput('') }
  const delOption = (i:number) => setOpts(o => o.filter((_,idx)=> idx!==i))
  const move = (i:number, dir:-1|1) => setQuestions(q => { const copy=q.slice(); const j=i+dir; if(j<0||j>=copy.length) return copy; const tmp=copy[i]; copy[i]=copy[j]; copy[j]=tmp; return copy })
  const remove = (i:number) => setQuestions(q => q.filter((_,idx)=> idx!==i))
  const edit = (i:number) => { const q=questions[i]; if(!q) return; setLabel(q.label||''); setType(q.type||'short_text'); setRequired(!!q.required); setOpts(Array.isArray(q.options)? q.options.slice():[]); setEditing(i) }

  const invalidLabel = (label||'').trim().length === 0
  const isChoice = type==='multiple_choice' || type==='dropdown'
  const invalidOptions = isChoice && opts.length < 2
  const canSave = !invalidLabel && !invalidOptions

  const saveQuestion = () => {
    const lbl=(label||'').trim(); if(!lbl) return; // guard
    const q:any = { id: (editing!=null && questions[editing]?.id) || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, label: lbl, type, required }
    if(type==='multiple_choice' || type==='dropdown'){
      if(opts.length<2) return; q.options = opts.slice()
    }
    setQuestions(list => {
      if(editing!=null){ const copy=list.slice(); copy[editing]=q; return copy }
      return [...list, q]
    })
    resetForm()
  }

  const showOpts = type==='multiple_choice' || type==='dropdown'

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">{t('verification.form.title')}</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1" htmlFor="q-label">{t('verification.form.newQuestionLabel')}</label>
          <input id="q-label" title={t('verification.form.newQuestionLabel')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={label} onChange={e=> setLabel(e.target.value)} placeholder={t('verification.form.newQuestionLabel')} />
          {invalidLabel && <div className="text-xs text-rose-400 mt-1">{t('verification.form.errors.needLabel')}</div>}
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="q-type">{t('verification.form.type')}</label>
          <select id="q-type" title={t('verification.form.type')} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={type} onChange={e=> setType(e.target.value as any)}>
            <option value="short_text">{t('verification.form.type.short_text')}</option>
            <option value="long_text">{t('verification.form.type.long_text')}</option>
            <option value="yes_no">{t('verification.form.type.yes_no')}</option>
            <option value="multiple_choice">{t('verification.form.type.multiple_choice')}</option>
            <option value="dropdown">{t('verification.form.type.dropdown')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="q-required" type="checkbox" checked={required} onChange={e=> setRequired(e.target.checked)} />
          <label htmlFor="q-required">{t('verification.form.required')}</label>
        </div>
        <div>
          <button type="button" disabled={!canSave} onClick={saveQuestion} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 w-full disabled:opacity-60">{editing!=null? t('verification.form.updateQuestion') : t('verification.form.addQuestion')}</button>
        </div>
      </div>

      {showOpts && (
        <div>
          <label className="block text-sm mb-1">{t('verification.form.options')}</label>
          <div className="flex gap-2">
            <input title={t('verification.form.option.placeholder')} className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={optInput} onChange={e=> setOptInput(e.target.value)} placeholder={t('verification.form.option.placeholder')} />
            <button type="button" onClick={addOption} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.form.addOption')}</button>
          </div>
          <ul className="mt-2 space-y-2">
            {opts.map((o,i)=> (
              <li key={`${o}-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                <span className="text-sm">{o}</span>
                <button type="button" onClick={()=> delOption(i)} className="text-xs text-rose-400 hover:text-rose-300">{t('verification.form.delete')}</button>
              </li>
            ))}
          </ul>
          {invalidOptions && <div className="text-xs text-rose-400 mt-1">{t('verification.form.errors.needTwoOptions')}</div>}
        </div>
      )}

      <div>
        <div className="text-sm mb-2 opacity-80">{t('verification.form.list')}</div>
        {questions.length === 0 && <div className="text-sm opacity-60">{t('verification.metrics.noData')}</div>}
        <ul className="space-y-2">
          {questions.map((q, idx) => (
            <li key={q.id || idx} className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-medium">{q.label}</div>
                  <div className="text-xs opacity-70">{t(`verification.form.type.${q.type}`)}</div>
                  {Array.isArray(q.options) && q.options.length>0 && (
                    <div className="text-xs opacity-70">{t('verification.form.options')}: {q.options.length}</div>
                  )}
                  {q.required && <div className="text-xs text-amber-300">{t('verification.form.required')}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={()=> move(idx, -1)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.form.moveUp')}</button>
                  <button type="button" onClick={()=> move(idx, +1)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.form.moveDown')}</button>
                  <button type="button" onClick={()=> edit(idx)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.form.edit')}</button>
                  <button type="button" onClick={()=> remove(idx)} className="text-xs px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 border border-rose-600">{t('verification.form.delete')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Import / Export */}
      <div className="pt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => exportQuestions(questions)} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">{t('verification.form.export')}</button>
        <label className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 cursor-pointer">
          <input type="file" accept="application/json" className="hidden" onChange={(e)=> importQuestions(e, setQuestions, setImportError)} />
          {t('verification.form.import')}
        </label>
        {importError && <div className="text-xs text-rose-400">{importError}</div>}
      </div>
    </div>
  )
}

// --- PanelPreview subcomponent ---
function PanelPreview({ title, description, buttonLabel, color, hideButton }: { title: string; description: string; buttonLabel: string; color: string; hideButton?: boolean }){
  const borderColor = /^#?[0-9a-fA-F]{6}$/.test((color||'').replace('#','')) ? (color.startsWith('#')? color : '#'+color) : '#7C3AED'
  return (
    <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/50">
      <svg className="w-full mb-3" role="img" aria-label="color-preview" height="4">
        <rect x="0" y="0" width="100%" height="4" fill={borderColor} />
      </svg>
      <div className="font-semibold text-lg mb-1">{title || '🔒 Verificação do Servidor'}</div>
      <div className="text-sm opacity-90 whitespace-pre-line">{description || 'Clica em Verificar para concluir e ganhar acesso aos canais.'}</div>
      {!hideButton && (
        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-700"><span className="mr-1">✅</span>{buttonLabel || 'Verificar'}</button>
        </div>
      )}
    </div>
  )
}

// Helpers for import/export
function exportQuestions(questions: any[]) {
  try {
    const blob = new Blob([JSON.stringify(questions || [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'verification-form.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {}
}

function importQuestions(e: any, setQuestions: (q:any[])=>void, setErr: (s:string|null)=>void) {
  try {
    setErr(null)
    const file = e?.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result||'[]'))
        if (!Array.isArray(data)) throw new Error('invalid')
        const allowed = new Set(['short_text','long_text','yes_no','multiple_choice','dropdown'])
        const normalized = data.map((q:any)=>{
          const label = String(q?.label||'').trim()
          const type = String(q?.type||'short_text')
          const required = !!q?.required
          const options = Array.isArray(q?.options) ? q.options.map((s:any)=> String(s)).filter(Boolean) : undefined
          if (!label) throw new Error('invalid')
          if (!allowed.has(type)) throw new Error('invalid')
          if ((type==='multiple_choice'||type==='dropdown') && (!options || options.length<2)) throw new Error('invalid')
          return { id: String(q?.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`), label, type, required, options }
        })
        setQuestions(normalized)
      } catch {
        setErr('invalid')
      }
    }
    reader.readAsText(file)
  } catch { setErr('invalid') }
}
