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
			// Prefer dedicated endpoint; fallback to PATCH if not available
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

	return (
		<div className='space-y-4'>
			<div className='card p-4 space-y-3'>
				<div className='flex flex-wrap gap-4'>
					<div>
						<label htmlFor='out-type' className='text-xs text-neutral-400'>Tipo</label>
						<select id='out-type' name='type' className='mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1' value={form.type} onChange={e=> setForm(f=>({...f, type:e.target.value}))}>
							{TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
						</select>
					</div>
					<div className='flex-1 min-w-[240px]'>
						<label htmlFor='out-url' className='text-xs text-neutral-400'>URL (https)</label>
						<input id='out-url' name='url' className='mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1' value={form.url} onChange={e=> setForm(f=>({...f, url:e.target.value}))} placeholder='https://example.com/webhook' />
					</div>
					<div>
						<label htmlFor='out-channelId' className='text-xs text-neutral-400'>ChannelId (opcional)</label>
						<input id='out-channelId' name='channelId' className='mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1' value={form.channelId} onChange={e=> setForm(f=>({...f, channelId:e.target.value}))} placeholder='1234567890' />
					</div>
					<button type='button' disabled={loading} onClick={create} className='self-end mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50'>Criar</button>
				</div>
			</div>
			<div className='card p-4 space-y-3'>
				<div className='flex items-center gap-3'>
					<button type='button' onClick={()=> setBulkTestOpen(o=> !o)} className='px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs'>Teste Todos (bulk)</button>
					{bulkTestOpen && <button type='button' onClick={doBulkTest} className='px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 text-xs'>Enviar Bulk</button>}
					{bulkTestOpen && <button type='button' onClick={()=> setBulkTestOpen(false)} className='px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs'>Cancelar</button>}
				</div>
				{bulkTestOpen && (
					<div>
						<label htmlFor='out-bulk-payload' className='text-xs text-neutral-400'>Payload JSON para todos</label>
						<textarea id='out-bulk-payload' name='bulkPayload' className='mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs h-24' value={bulkPayload} onChange={e=> setBulkPayload(e.target.value)} />
						<p className='text-[10px] text-neutral-500 mt-1'>Este payload será enviado a todos os webhooks ativos.</p>
					</div>
				)}
			</div>
			<div className='card p-0'>
				<div className='divide-y divide-neutral-800'>
					{loading && <div className='p-4 text-neutral-400'>A carregar…</div>}
					{!loading && items.length === 0 && <div className='p-4 text-neutral-500 text-sm'>Nenhum webhook configurado.</div>}
					{items.map(i => (
						<div key={i.id} className='p-4 space-y-2'>
							<div className='flex items-center gap-3'>
								<div className='flex-1 min-w-0'>
									<div className='text-neutral-200 truncate'>
										{i.type} {i.enabled ? <span className='ml-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-700/60 text-emerald-300'>ativo</span> : <span className='ml-1 text-[10px] px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400'>inativo</span>}
										{i.lastOk != null && (
											<span
												title={`${i.lastOk ? 'Último teste OK' : 'Último teste falhou'}${i.lastStatus != null ? ` (status ${i.lastStatus})` : ''}${i.lastAt ? ` em ${new Date(i.lastAt).toLocaleString()}` : ''}${i.lastError ? `\nErro: ${i.lastError}` : ''}`}
												className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${i.lastOk ? 'border-emerald-700/60 text-emerald-300' : 'border-rose-700/60 text-rose-300'}`}
											>
												{i.lastOk ? 'ok' : 'falha'}{i.lastStatus != null ? ` ${i.lastStatus}` : ''}
											</span>
										)}
									</div>
										<div className='text-xs text-neutral-500 truncate'>
											{i.id} • {i.channelId || '—'} • {i.urlMasked} {i.lastAt ? `• ${new Date(i.lastAt).toLocaleTimeString()}` : ''}
											{i.lastError && <span className='ml-2 text-[10px] text-rose-400' title={i.lastError}>({i.lastError.slice(0,60)})</span>}
										</div>
								</div>
									<button type='button' onClick={()=> startTestPayload(i)} className='px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'>Testar</button>
									{!i.enabled && <button type='button' disabled={activateTesting===i.id} onClick={()=> testAndActivate(i.id)} className='px-2 py-1 text-xs rounded bg-brand-700/80 border border-brand-600 hover:bg-brand-700 disabled:opacity-50'>{activateTesting===i.id ? 'A testar...' : 'Testar & Ativar'}</button>}
								<button type='button' onClick={()=> toggle(i.id)} className='px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'>{i.enabled ? 'Desativar' : 'Ativar'}</button>
								{editing?.id === i.id ? (
									<button type='button' onClick={saveEdit} className='px-2 py-1 text-xs rounded bg-brand-600 hover:bg-brand-700'>Guardar</button>
								) : (
									<button type='button' onClick={()=> startEdit(i)} className='px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'>Editar URL</button>
								)}
								<button type='button' onClick={()=> remove(i.id)} className='px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500'>Remover</button>
							</div>
							{editing?.id === i.id && (
								<div className='flex gap-2 items-center'>
									<input aria-label='Editar URL do webhook' className='flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs' placeholder='https://example.com/webhook' value={editing.url} onChange={e=> setEditing(ed=> ed ? { ...ed, url: e.target.value } : ed)} />
									<button type='button' onClick={()=> setEditing(null)} className='px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'>Cancelar</button>
								</div>
							)}
							{testing?.id === i.id && (
								<div className='space-y-2'>
									<textarea aria-label='Payload de teste' className='w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs h-20' value={testing.payload} onChange={e=> setTesting(t=> t ? { ...t, payload: e.target.value } : t)} />
									<div className='flex gap-2'>
										<button type='button' onClick={sendTestPayload} className='px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-700'>Enviar Teste</button>
										<button type='button' onClick={()=> setTesting(null)} className='px-3 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'>Cancelar</button>
									</div>
									<p className='text-[10px] text-neutral-500'>Envie JSON personalizado. Ex: {`{"ticketId":"123","test":true}`}</p>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
