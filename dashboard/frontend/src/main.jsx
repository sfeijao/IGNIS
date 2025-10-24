import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import './index.css'

// Utils
const getGuildId = () => {
  const params = new URLSearchParams(location.search)
  const urlId = params.get('guildId')
  if (urlId) return urlId
  try { return localStorage.getItem('IGNIS_LAST_GUILD') } catch { return null }
}

const formatTime = (iso) => {
  try { const d = new Date(iso); return d.toLocaleString(); } catch { return iso; }
}

const TYPE_META = {
  'message_delete': { icon: 'fa-trash', color: 'text-red-400 border-red-500/30' },
  'message_edit':   { icon: 'fa-pen', color: 'text-amber-400 border-amber-500/30' },
  'member_join':    { icon: 'fa-user-plus', color: 'text-emerald-400 border-emerald-500/30' },
  'member_leave':   { icon: 'fa-user-minus', color: 'text-rose-400 border-rose-500/30' },
  'voice_join':     { icon: 'fa-volume-high', color: 'text-sky-400 border-sky-500/30' },
  'voice_leave':    { icon: 'fa-volume-off', color: 'text-sky-400 border-sky-500/30' },
  'voice_move':     { icon: 'fa-right-left', color: 'text-sky-400 border-sky-500/30' },
  'ban':            { icon: 'fa-ban', color: 'text-rose-400 border-rose-500/30' },
  'unban':          { icon: 'fa-unlock', color: 'text-lime-400 border-lime-500/30' },
  'warn':           { icon: 'fa-triangle-exclamation', color: 'text-yellow-400 border-yellow-500/30' },
  'mute':           { icon: 'fa-volume-xmark', color: 'text-amber-300 border-amber-500/30' },
  'kick':           { icon: 'fa-boot', color: 'text-orange-300 border-orange-500/30' },
}
const metaForType = (t) => {
  if (!t) return { icon: 'fa-circle-info', color: 'text-indigo-300 border-indigo-500/30' };
  const key = String(t).toLowerCase();
  for (const k of Object.keys(TYPE_META)) {
    if (key === k || key.startsWith(k)) return TYPE_META[k];
  }
  return { icon: 'fa-circle-info', color: 'text-indigo-300 border-indigo-500/30' };
}

function ModerationFilters({ value, onChange, onSearch, onReset, onExport, autoRefresh, setAutoRefresh }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const set = (k, v) => setLocal(prev => ({ ...prev, [k]: v }))
  const apply = () => onSearch(local)
  const reset = () => onReset()
  return (
    <div className="glass-card card-pad mb-8">
      <div className="grid grid-4 gap-12">
        <div>
          <label>Tipo</label>
          <select className="input" value={local.type} onChange={e=>set('type', e.target.value)}>
            <option value="">Todos</option>
            <option value="message_delete">Mensagens apagadas</option>
            <option value="message_edit">Mensagens editadas</option>
            <option value="member_*">Entradas/Saídas</option>
            <option value="voice_*">Eventos de voz</option>
            <option value="ban">Ban</option>
            <option value="unban">Unban</option>
            <option value="warn">Advertências</option>
            <option value="mute">Mutes</option>
            <option value="kick">Kicks</option>
          </select>
        </div>
        <div>
          <label>Moderador</label>
          <input className="input" placeholder="ID do moderador" value={local.moderatorId||''} onChange={e=>set('moderatorId', e.target.value)} />
        </div>
        <div>
          <label>Canal</label>
          <input className="input" placeholder="ID do canal" value={local.channelId||''} onChange={e=>set('channelId', e.target.value)} />
        </div>
        <div>
          <label>Utilizador</label>
          <input className="input" placeholder="ID do utilizador" value={local.userId||''} onChange={e=>set('userId', e.target.value)} />
        </div>
        <div>
          <label>De</label>
          <input type="date" className="input" value={local.from||''} onChange={e=>set('from', e.target.value)} />
        </div>
        <div>
          <label>Até</label>
          <input type="date" className="input" value={local.to||''} onChange={e=>set('to', e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" onClick={apply}><i className="fas fa-filter"></i> Aplicar</button>
          <button className="btn btn-glass" onClick={reset}><i className="fas fa-undo"></i> Limpar</button>
          <button className="btn btn-glass" onClick={()=>onExport('csv')}><i className="fas fa-file-csv"></i> CSV</button>
          <button className="btn btn-glass" onClick={()=>onExport('json')}><i className="fas fa-file-code"></i> JSON</button>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-secondary"><input type="checkbox" className="mr-2" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} /> Atualização automática</label>
        </div>
      </div>
    </div>
  )
}

function ModerationStats({ logs }) {
  const stats = useMemo(() => {
    const agg = {}
    ;(logs||[]).forEach(l => {
      const t = (l.type||'').toLowerCase();
      const key = Object.keys(TYPE_META).find(k => t===k || t.startsWith(k)) || 'other';
      agg[key] = (agg[key]||0) + 1
    })
    return Object.entries(agg).map(([k,v]) => ({ type:k, count:v }))
  }, [logs])
  if (!stats.length) return null
  return (
    <div className="grid grid-3 gap-12 mt-12">
      {stats.map(s => {
        const meta = metaForType(s.type)
        return (
          <div key={s.type} className="glass-card card-pad">
            <div className={`badge stat ${meta.color.replace('text-','')}`.trim()}>
              <i className={`fas ${meta.icon}`}></i>
              <span className="text-secondary">{s.type}</span>
            </div>
            <div className="mt-8 text-2xl font-bold">{s.count}</div>
          </div>
        )
      })}
    </div>
  )
}

function DetailsModal({ log, onClose }) {
  if (!log) return null
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000]">
      <div className="glass-card p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold"><i className="fas fa-circle-info mr-2"></i> Detalhes</h3>
          <button className="btn btn-glass btn-sm" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <pre className="text-sm overflow-auto max-h-[60vh] bg-white/5 border border-white/10 rounded p-3">{JSON.stringify(log, null, 2)}</pre>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function ModerationCard({ item, onDetails }) {
  const meta = metaForType(item.type)
  const user = item.resolved?.user?.username || item.data?.username || item.actor_id || 'Utilizador'
  const chan = item.resolved?.channel?.name || item.data?.channelId || ''
  return (
    <div className="fade-in border border-white/10 rounded-xl p-3 bg-white/5 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${meta.color}`}>
            <i className={`fas ${meta.icon}`}></i>
          </div>
          <div>
            <div className="font-semibold">{user}</div>
            <div className="text-secondary text-sm">{item.type} • {formatTime(item.timestamp)}{chan?` • #${chan}`:''}</div>
          </div>
        </div>
        <button className="btn btn-glass btn-sm" onClick={()=>onDetails(item)}>
          <i className="fas fa-eye"></i> Ver detalhes
        </button>
      </div>
      {item.message && <div className="text-sm text-secondary mt-1">{item.message}</div>}
      {item.type?.toLowerCase().startsWith('message_edit') && (
        <div className="mt-2 text-sm grid gap-2">
          {item.data?.old && <div><span className="text-secondary">Anterior:</span> {item.data.old}</div>}
          {item.data?.new && <div><span className="text-secondary">Nova:</span> {item.data.new}</div>}
        </div>
      )}
    </div>
  )
}

function ModerationFeed({ items, onDetails, onLoadMore, hasMore, loading }) {
  const listRef = useRef(null)
  return (
    <div className="glass-card card-pad">
      <div ref={listRef} className="scroll-area grid gap-3">
        {items.map(it => <ModerationCard key={`${it.id||it.timestamp}-${Math.random()}`} item={it} onDetails={onDetails} />)}
        {loading && <div className="text-center text-secondary py-3"><i className="fas fa-spinner fa-spin"></i> A carregar…</div>}
      </div>
      <div className="flex justify-center mt-4">
        {hasMore && !loading && (
          <button className="btn btn-glass" onClick={onLoadMore}><i className="fas fa-angles-down"></i> Carregar mais</button>
        )}
      </div>
    </div>
  )
}

function Charts({ guildId, filters, data, period, onPeriod }) {
  const aggregateClient = React.useCallback((logs) => {
    const byDay = new Map();
    (logs||[]).forEach(l => {
      const d = new Date(l.timestamp);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0,10);
      const t = (l.type||'').toLowerCase();
      const cat = Object.keys(TYPE_META).find(k => t===k || t.startsWith(k)) || 'other';
      if (!byDay.has(key)) byDay.set(key, { date:key, deletes:0, bans:0, voice:0, warns:0, other:0 });
      const row = byDay.get(key);
      if (cat.startsWith('message_delete')) row.deletes++;
      else if (cat.startsWith('ban')) row.bans++;
      else if (cat.startsWith('voice')) row.voice++;
      else if (cat.startsWith('warn')) row.warns++;
      else row.other++;
    });
    return Array.from(byDay.values()).sort((a,b)=>a.date.localeCompare(b.date));
  }, [])

  const [series, setSeries] = useState(() => aggregateClient(data))
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  const buildStatsQuery = React.useCallback(() => {
    const p = new URLSearchParams()
    if (filters?.type) p.set('type', filters.type)
    if (filters?.moderatorId) p.set('moderatorId', filters.moderatorId)
    if (filters?.channelId) p.set('channelId', filters.channelId)
    if (filters?.userId) p.set('userId', filters.userId)
    if (filters?.from) p.set('from', filters.from)
    if (filters?.to) p.set('to', filters.to)
    p.set('period', period)
    return p.toString()
  }, [filters, period])

  useEffect(() => {
    if (!guildId) { setSeries(aggregateClient(data)); return; }
    let cancelled = false
    setStatsLoading(true)
    setStatsError('')
    const qs = buildStatsQuery()
    fetch(`/api/guild/${guildId}/logs/stats?${qs}`, { credentials:'same-origin' })
      .then(r => { if (!r.ok) throw new Error('Falha ao carregar estatísticas'); return r.json(); })
      .then(body => {
        if (cancelled) return
        const serverSeries = Array.isArray(body?.series) ? body.series : (Array.isArray(body?.data) ? body.data : null)
        if (serverSeries) setSeries(serverSeries)
        else setSeries(aggregateClient(data))
      })
      .catch(() => { if (cancelled) return; setStatsError('Sem estatísticas do servidor – a usar cálculo local'); setSeries(aggregateClient(data)) })
      .finally(() => { if (!cancelled) setStatsLoading(false) })
    return () => { cancelled = true }
  }, [guildId, period, data, aggregateClient, buildStatsQuery])

  return (
    <div className="glass-card card-pad mt-12">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold"><i className="fas fa-chart-line mr-2"></i> Últimos {period==='24h'?'1 dia':period==='7d'?'7 dias':'30 dias'}</h3>
        <div className="flex gap-2">
          {['24h','7d','30d'].map(p => (
            <button key={p} className={`btn btn-sm ${p===period?'btn-primary':'btn-glass'}`} onClick={()=>onPeriod(p)}>{p.toUpperCase()}</button>
          ))}
        </div>
      </div>
      {statsLoading && <div className="text-secondary text-sm mb-2"><i className="fas fa-spinner fa-spin mr-2"></i>A carregar estatísticas…</div>}
      {statsError && <div className="text-secondary text-xs mb-2">{statsError}</div>}
      <div style={{height: 280}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" stroke="#B8BCC8" tick={{fill:'#B8BCC8'}} />
            <YAxis stroke="#B8BCC8" tick={{fill:'#B8BCC8'}} />
            <Tooltip contentStyle={{ background:'rgba(17,24,39,0.9)', border:'1px solid rgba(255,255,255,0.1)'}} />
            <Legend />
            <Line type="monotone" dataKey="deletes" stroke="#ef4444" dot={false} />
            <Line type="monotone" dataKey="bans" stroke="#a855f7" dot={false} />
            <Line type="monotone" dataKey="voice" stroke="#38bdf8" dot={false} />
            <Line type="monotone" dataKey="warns" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function App() {
  const guildId = getGuildId()
  const [filters, setFilters] = useState({ type:'', moderatorId:'', channelId:'', userId:'', from:'', to:'' })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [period, setPeriod] = useState('7d')

  useEffect(() => {
    const dash = document.getElementById('backDashboard')
    if (dash) {
      const gid = guildId || ''
      dash.href = gid ? `/dashboard?guildId=${encodeURIComponent(gid)}` : '/dashboard'
    }
  }, [guildId])

  const buildQuery = (extra = {}) => {
    const p = new URLSearchParams()
    const f = { ...filters, ...extra }
    if (f.type) p.set('type', f.type)
    if (f.moderatorId) p.set('moderatorId', f.moderatorId)
    if (f.channelId) p.set('channelId', f.channelId)
    if (f.userId) p.set('userId', f.userId)
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
    p.set('limit', String(50))
    p.set('offset', String(extra.offset ?? offset))
    return p.toString()
  }

  const fetchLogs = async (opts = { append:false, resetOffset:false }) => {
    if (!guildId) { setError('guildId em falta'); return; }
    if (opts.resetOffset) setOffset(0)
    setLoading(true); setError('')
    try {
      const query = buildQuery({ offset: opts.resetOffset ? 0 : offset })
      const r = await fetch(`/api/guild/${guildId}/logs?${query}`, { credentials: 'same-origin' })
      if (!r.ok) throw new Error('Falha ao carregar logs')
      const d = await r.json()
      const list = Array.isArray(d.logs) ? d.logs : []
      setHasMore(list.length === 50)
      setItems(prev => opts.append ? [...prev, ...list] : list)
      if (opts.append) setOffset(prev => prev + list.length)
      else setOffset(list.length)
    } catch (e) {
      setError(e.message || 'Erro ao buscar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs({ append:false, resetOffset:true }) }, [guildId])

  useEffect(() => {
    if (!autoRefresh || !guildId) return
    let es = null; let pollId = null

    const startPolling = () => {
      if (pollId) return
      pollId = setInterval(() => fetchLogs({ append:false, resetOffset:true }), 15000)
    }

    const filtersActive = !!(filters.type || filters.moderatorId || filters.channelId || filters.userId || filters.from || filters.to)
    const dedupeMerge = (incoming) => {
      if (!Array.isArray(incoming) || !incoming.length) return
      setItems(prev => {
        const seen = new Set(prev.map(x => (x.id || x._id || x.timestamp)))
        const add = []
        for (let i=incoming.length-1; i>=0; i--) {
          const k = incoming[i]?.id || incoming[i]?._id || incoming[i]?.timestamp
          if (!seen.has(k)) add.push(incoming[i])
        }
        const next = add.length ? [...add, ...prev] : prev
        return next.slice(0, 500)
      })
    }

    try {
      es = new EventSource(`/api/guild/${guildId}/logs/stream`)
      es.addEventListener('init', (ev) => {
        try {
          const payload = JSON.parse(ev.data||'{}')
          if (!filtersActive && Array.isArray(payload.logs)) dedupeMerge(payload.logs)
          else fetchLogs({ append:false, resetOffset:true })
        } catch { fetchLogs({ append:false, resetOffset:true }) }
      })
      es.addEventListener('update', (ev) => {
        try {
          const payload = JSON.parse(ev.data||'{}')
          if (!filtersActive && Array.isArray(payload.logs)) dedupeMerge(payload.logs)
          else fetchLogs({ append:false, resetOffset:true })
        } catch { fetchLogs({ append:false, resetOffset:true }) }
      })
      es.onerror = () => { try { es && es.close(); } catch {} startPolling(); }
    } catch {
      startPolling()
    }

    return () => {
      if (es) { try { es.close(); } catch {} }
      if (pollId) clearInterval(pollId)
    }
  }, [autoRefresh, guildId, filters])

  const onSearch = (f) => { setFilters(f); fetchLogs({ append:false, resetOffset:true }) }
  const onReset = () => { setFilters({ type:'', moderatorId:'', channelId:'', userId:'', from:'', to:'' }); fetchLogs({ append:false, resetOffset:true }) }
  const onExport = (format) => {
    const q = buildQuery()
    const a = document.createElement('a')
    a.href = `/api/guild/${guildId}/logs/export?format=${encodeURIComponent(format)}&${q}`
    a.download = `logs.${format}`
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <section className="dashboard-section fade-in">
      <div className="section-header">
        <h1 className="section-title"><i className="fas fa-shield-halved"></i> Centro de Moderação</h1>
        <p className="text-secondary">Logs em tempo real e filtros avançados.</p>
      </div>

      <ModerationFilters
        value={filters}
        onChange={setFilters}
        onSearch={onSearch}
        onReset={onReset}
        onExport={onExport}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      <ModerationStats logs={items} />

      <div className="mt-12 grid grid-1 gap-12">
        <ModerationFeed
          items={items}
          onDetails={setModal}
          onLoadMore={() => fetchLogs({ append:true })}
          hasMore={hasMore}
          loading={loading}
        />
      </div>

      <Charts guildId={guildId} filters={filters} data={items} period={period} onPeriod={setPeriod} />

      {error && <div className="mt-4 text-red-400">{error}</div>}
      {modal && <DetailsModal log={modal} onClose={()=>setModal(null)} />}
    </section>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)

// Ensure back to dashboard respects stored guild after mount
try {
  const gid = getGuildId()
  const el = document.getElementById('backDashboard')
  if (el) el.href = gid ? `/dashboard?guildId=${encodeURIComponent(gid)}` : '/dashboard'
} catch {}
