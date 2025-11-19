"use client"
import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useToast } from './Toaster'

interface Item { id: string; type: string; enabled: boolean; channelId?: string|null; urlMasked?: string|null; lastOk?: boolean|null; lastStatus?: number|null; lastError?: string|null; lastAt?: string|null; createdAt?: string; updatedAt?: string }

const TYPES = ['transcript','vlog','modlog','generic'] as const

export default function OutgoingWebhooksManager(){
	const guildId = useGuildId()
	const { toast } = useToast()
	const [items, setItems] = useState<Item[]>([])
	const [loading, setLoading] = useState(false)
	const [enabled, setEnabled] = useState(true)
	const [form, setForm] = useState({ type: 'transcript', url: '', channelId: '' })
	const [editing, setEditing] = useState<{ id: string; url: string } | null>(null)
	const [activateTesting, setActivateTesting] = useState<string | null>(null)
	const [testing, setTesting] = useState<{ id: string; type: string; payload: string } | null>(null)
	const [bulkTestOpen, setBulkTestOpen] = useState(false)
	const [bulkPayload, setBulkPayload] = useState('{"bulk": true}')

	async function load(){
		if(!guildId) return
		setLoading(true)
		try {
			const res = await api.getOutgoingWebhooks(guildId)
			setItems(res.items || [])
		} catch(e:any){ toast({ type:'error', title:'Erro', description: e.message }) } finally { setLoading(false) }
	}
	useEffect(()=>{ load() },[guildId])

	async function create(){
		if(!guildId) return
		if(!form.url.trim()) { toast({ type:'error', title:'URL obrigatória'}); return }
		setLoading(true)
		try {
			const body = { type: form.type, url: form.url.trim(), channelId: form.channelId || undefined }
			await api.createOutgoingWebhook(guildId, body)
			toast({ type:'success', title:'Webhook criado'})
			setForm({ type: 'transcript', url: '', channelId: '' })
			await load()
		} catch(e:any){ toast({ type:'error', title:'Falhou criar', description: e.message }) } finally { setLoading(false) }
	}

	async function toggle(id:string){
		if(!guildId) return
		setLoading(true)
		try {
			const item = items.find(i=> i.id === id)
			if(!item) throw new Error('Não encontrado')
			await api.updateOutgoingWebhook(guildId, id, { enabled: !item.enabled })
			toast({ type:'success', title:'Atualizado'})
			await load()
		} catch(e:any){ toast({ type:'error', title:'Falhou atualizar', description: e.message }) } finally { setLoading(false) }
	}

	async function testAndActivate(id:string){
		if(!guildId) return
		setActivateTesting(id)
		try {
			const item = items.find(i=> i.id === id)
			if(!item) throw new Error('Não encontrado')
			try {
				await api.testActivateOutgoingWebhook(guildId, id)
			} catch(err:any){
				await api.updateOutgoingWebhook(guildId, id, { enabled: true })
			}
			toast({ type:'success', title:'Testado & Atualizado'})
			await load()
		} catch(e:any){ toast({ type:'error', title:'Falhou testar/ativar', description: e.message }) } finally { setActivateTesting(null) }
	}

	async function remove(id:string){
		if(!guildId) return
		if(!confirm('Remover webhook?')) return
		setLoading(true)
		try {
			await api.deleteOutgoingWebhook(guildId, id)
			toast({ type:'success', title:'Removido'})
			await load()
		} catch(e:any){ toast({ type:'error', title:'Falhou remover', description: e.message }) } finally { setLoading(false) }
	}

	async function test(type:string, payload?: any){
		if(!guildId) return
		setLoading(true)
		try {
			await api.testOutgoingWebhook(guildId, type, payload)
			toast({ type:'success', title:'Teste enviado'})
		} catch(e:any){ toast({ type:'error', title:'Falhou teste', description: e.message }) } finally { setLoading(false) }
	}

	function startEdit(item: Item){
		setEditing({ id: item.id, url: '' })
	}

	async function saveEdit(){
		if(!editing || !guildId) return
		const url = editing.url.trim()
		if(!url){ toast({ type:'error', title:'URL vazia'}); return }
		setLoading(true)
		try {
			await api.updateOutgoingWebhook(guildId, editing.id, { url })
			toast({ type:'success', title:'URL atualizada'})
			setEditing(null)
			await load()
		} catch(e:any){ toast({ type:'error', title:'Falhou atualizar', description: e.message }) } finally { setLoading(false) }
	}

	function startTestPayload(item: Item){
		setTesting({ id: item.id, type: item.type, payload: '{"test": true}' })
	}

	async function sendTestPayload(){
		if(!testing) return
		let parsed: any = null
		try { parsed = JSON.parse(testing.payload) } catch { toast({ type:'error', title:'JSON inválido'}); return }
		await test(testing.type, parsed)
		setTesting(null)
	}

	async function doBulkTest(){
		if(!guildId) return
		let parsed: any = null
		try { parsed = JSON.parse(bulkPayload) } catch { toast({ type:'error', title:'JSON inválido (bulk)'}); return }
		setLoading(true)
		try {
			await api.testAllOutgoingWebhooks(guildId, parsed)
			toast({ type:'success', title:'Bulk teste enviado'})
			setBulkTestOpen(false)
		} catch(e:any){ toast({ type:'error', title:'Falhou bulk teste', description: e.message }) } finally { setLoading(false) }
	}

	const totalWebhooks = items.length
	const activeWebhooks = items.filter(i => i.enabled).length
	const successfulTests = items.filter(i => i.lastOk === true).length

	return (
		<div className='space-y-6'>
			{/* Header with Toggle */}
			<div className="bg-gradient-to-r from-teal-600/20 to-green-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="text-4xl">🔗</span>
						<div>
							<h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
								Outgoing Webhooks
							</h2>
							<p className="text-gray-400 text-sm mt-1">Manage external webhook integrations</p>
						</div>
					</div>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							className="sr-only peer"
							checked={enabled}
							onChange={(e) => setEnabled(e.target.checked)}
						/>
						<div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-teal-600 peer-checked:to-green-600"></div>
					</label>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 bg-gradient-to-br from-teal-600/20 to-green-600/20 rounded-lg flex items-center justify-center text-2xl">
							📊
						</div>
						<div>
							<div className="text-2xl font-bold text-white">{totalWebhooks}</div>
							<div className="text-sm text-gray-400">Total Webhooks</div>
						</div>
					</div>
				</div>

				<div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
							✅
						</div>
						<div>
							<div className="text-2xl font-bold text-green-400">{activeWebhooks}</div>
							<div className="text-sm text-gray-400">Active</div>
						</div>
					</div>
				</div>

				<div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
							✓
						</div>
						<div>
							<div className="text-2xl font-bold text-cyan-400">{successfulTests}</div>
							<div className="text-sm text-gray-400">Last Test OK</div>
						</div>
					</div>
				</div>
			</div>

			{/* Create Webhook */}
			<div className='bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6'>
				<div className="flex items-center gap-3 mb-6">
					<span className="text-2xl">➕</span>
					<h3 className="text-lg font-semibold text-white">Create New Webhook</h3>
				</div>
				<div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">Tipo</label>
						<select className='w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all' value={form.type} onChange={e=> setForm(f=>({...f, type:e.target.value}))}>
							{TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
						</select>
					</div>
					<div className='md:col-span-2 space-y-2'>
						<label className="text-sm font-medium text-gray-300">URL (https)</label>
						<input className='w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all' value={form.url} onChange={e=> setForm(f=>({...f, url:e.target.value}))} placeholder='https://example.com/webhook' />
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">ChannelId (opcional)</label>
						<input className='w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all' value={form.channelId} onChange={e=> setForm(f=>({...f, channelId:e.target.value}))} placeholder='1234567890' />
					</div>
					<div className="flex items-end">
						<button type='button' disabled={loading || !enabled} onClick={create} className='w-full py-3 px-6 bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-500 hover:to-green-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'>Criar</button>
					</div>
				</div>
			</div>

			{/* Bulk Test */}
			<div className='bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6'>
				<div className='flex items-center justify-between mb-4'>
					<div className="flex items-center gap-3">
						<span className="text-2xl">🧪</span>
						<h3 className="text-lg font-semibold text-white">Bulk Testing</h3>
					</div>
					<button type='button' onClick={()=> setBulkTestOpen(o=> !o)} className='px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all'>
						{bulkTestOpen ? 'Fechar' : 'Abrir Bulk Test'}
					</button>
				</div>
				{bulkTestOpen && (
					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">Payload JSON para todos</label>
							<textarea className='w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm h-24 font-mono' value={bulkPayload} onChange={e=> setBulkPayload(e.target.value)} />
							<p className='text-xs text-gray-500'>Este payload será enviado a todos os webhooks ativos.</p>
						</div>
						<div className="flex gap-3">
							<button type='button' onClick={doBulkTest} disabled={!enabled} className='px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all disabled:opacity-50'>Enviar Bulk Test</button>
							<button type='button' onClick={()=> setBulkTestOpen(false)} className='px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all'>Cancelar</button>
						</div>
					</div>
				)}
			</div>

			{/* Webhooks List */}
			<div className='bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6'>
				<div className="flex items-center gap-3 mb-6">
					<span className="text-2xl">📋</span>
					<h3 className="text-lg font-semibold text-white">Configured Webhooks</h3>
				</div>
				<div className='space-y-3'>
					{loading && <div className='text-center py-12'><div className="inline-block w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4"></div><div className="text-gray-400">A carregar...</div></div>}
					{!loading && items.length === 0 && <div className='text-center py-12'><div className="text-6xl mb-4">📭</div><div className='text-gray-400'>Nenhum webhook configurado.</div></div>}
					{items.map(i => (
						<div key={i.id} className='bg-gray-900/50 border border-gray-700 hover:border-teal-600/50 rounded-xl p-5 space-y-3 transition-all duration-200'>
							<div className='flex items-start gap-3 flex-wrap'>
								<div className='flex-1 min-w-0'>
									<div className='flex items-center gap-2 mb-2'>
										<span className='px-3 py-1 bg-teal-600/20 text-teal-400 rounded-lg text-sm font-medium uppercase'>{i.type}</span>
										{i.enabled ? 
											<span className='px-3 py-1 rounded-lg border border-green-700/60 text-green-300 text-xs'>ativo</span> : 
											<span className='px-3 py-1 rounded-lg border border-gray-700 text-gray-400 text-xs'>inativo</span>
										}
										{i.lastOk != null && (
											<span
												title={`${i.lastOk ? 'Último teste OK' : 'Último teste falhou'}${i.lastStatus != null ? ` (status ${i.lastStatus})` : ''}${i.lastAt ? ` em ${new Date(i.lastAt).toLocaleString()}` : ''}${i.lastError ? `\nErro: ${i.lastError}` : ''}`}
												className={`px-3 py-1 rounded-lg border text-xs ${i.lastOk ? 'border-green-700/60 text-green-300' : 'border-rose-700/60 text-rose-300'}`}
											>
												{i.lastOk ? '✓ ok' : '✗ falha'}{i.lastStatus != null ? ` ${i.lastStatus}` : ''}
											</span>
										)}
									</div>
									<div className='text-xs text-gray-500 truncate font-mono'>
										{i.id} • {i.channelId || '—'} • {i.urlMasked} {i.lastAt ? `• ${new Date(i.lastAt).toLocaleTimeString()}` : ''}
									</div>
									{i.lastError && <div className='text-xs text-rose-400 mt-1' title={i.lastError}>Error: {i.lastError.slice(0,80)}</div>}
								</div>
								<div className='flex gap-2 flex-wrap'>
									<button type='button' onClick={()=> startTestPayload(i)} disabled={!enabled} className='px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all disabled:opacity-50'>🧪 Testar</button>
									{!i.enabled && <button type='button' disabled={activateTesting===i.id || !enabled} onClick={()=> testAndActivate(i.id)} className='px-3 py-1.5 text-xs bg-teal-700/80 border border-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all disabled:opacity-50'>{activateTesting===i.id ? 'A testar...' : '⚡ Testar & Ativar'}</button>}
									<button type='button' onClick={()=> toggle(i.id)} disabled={!enabled} className='px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all disabled:opacity-50'>{i.enabled ? 'Desativar' : 'Ativar'}</button>
									{editing?.id === i.id ? (
										<button type='button' onClick={saveEdit} className='px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all'>💾 Guardar</button>
									) : (
										<button type='button' onClick={()=> startEdit(i)} disabled={!enabled} className='px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all disabled:opacity-50'>✏️ Editar URL</button>
									)}
									<button type='button' onClick={()=> remove(i.id)} disabled={!enabled} className='px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all disabled:opacity-50'>🗑️ Remover</button>
								</div>
							</div>
							{editing?.id === i.id && (
								<div className='flex gap-2 items-center'>
									<input aria-label='Editar URL do webhook' className='flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:ring-2 focus:ring-teal-500' placeholder='https://example.com/webhook' value={editing.url} onChange={e=> setEditing(ed=> ed ? { ...ed, url: e.target.value } : ed)} />
									<button type='button' onClick={()=> setEditing(null)} className='px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all'>Cancelar</button>
								</div>
							)}
							{testing?.id === i.id && (
								<div className='space-y-3 bg-gray-800/50 rounded-xl p-4'>
									<textarea aria-label='Payload de teste' className='w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm h-24 font-mono focus:ring-2 focus:ring-teal-500' value={testing.payload} onChange={e=> setTesting(t=> t ? { ...t, payload: e.target.value } : t)} />
									<div className='flex gap-2'>
										<button type='button' onClick={sendTestPayload} className='px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all text-sm'>Enviar Teste</button>
										<button type='button' onClick={()=> setTesting(null)} className='px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm'>Cancelar</button>
									</div>
									<p className='text-xs text-gray-500'>Envie JSON personalizado. Ex: {`{"ticketId":"123","test":true}`}</p>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
