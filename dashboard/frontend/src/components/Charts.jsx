import React, { useCallback, useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export default function Charts({ TYPE_META, guildId, filters, data, period, onPeriod }) {
  // Helper: client-side fallback aggregation
  const aggregateClient = useCallback((logs) => {
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
  }, [TYPE_META])

  const [series, setSeries] = useState(() => aggregateClient(data))
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  const buildStatsQuery = useCallback(() => {
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
