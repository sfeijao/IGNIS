(function(){
	const p=new URLSearchParams(window.location.search);
	const guildId=p.get('guildId');
	const els={
		template:document.getElementById('template'),
		mode:document.getElementById('mode'),
		method:document.getElementById('method'),
		cooldownSeconds:document.getElementById('cooldownSeconds'),
		logFails:document.getElementById('logFails'),
		logFailRetention:document.getElementById('logFailRetention'),
		save:document.getElementById('save'),
		formError:document.getElementById('formError'),
		methodHelp:document.getElementById('methodHelp'),
		verifiedRole:document.getElementById('verifiedRole'),
		unverifiedRole:document.getElementById('unverifiedRole'),
		panelChannel:document.getElementById('panelChannel'),
		title:document.getElementById('title'),
		description:document.getElementById('description'),
		buttonLabel:document.getElementById('buttonLabel'),
		color:document.getElementById('color'),
		colorPicker:document.getElementById('colorPicker'),
		createPanel:document.getElementById('createPanel'),
		// Metrics & logs
		metricsWindow:document.getElementById('metricsWindow'),
		metricsRefresh:document.getElementById('metricsRefresh'),
		metricSuccess:document.getElementById('metricSuccess'),
		metricFail:document.getElementById('metricFail'),
		metricTotal:document.getElementById('metricTotal'),
		byMethodList:document.getElementById('byMethodList'),
		failReasonsList:document.getElementById('failReasonsList'),
		exportLogs:document.getElementById('exportLogs'),
		pruneDays:document.getElementById('pruneDays'),
		pruneLogs:document.getElementById('pruneLogs'),
		logsList:document.getElementById('logsList'),
		// Form builder
		formBuilder:document.getElementById('formBuilder'),
		newQuestionLabel:document.getElementById('newQuestionLabel'),
		newQuestionType:document.getElementById('newQuestionType'),
		newQuestionRequired:document.getElementById('newQuestionRequired'),
		optionsEditor:document.getElementById('optionsEditor'),
		newOptionText:document.getElementById('newOptionText'),
		addOption:document.getElementById('addOption'),
		optionsList:document.getElementById('optionsList'),
		addQuestion:document.getElementById('addQuestion'),
		questionsList:document.getElementById('questionsList')
	};

	let original={};
	let questions=[]; // local state

	function notify(m,t='info'){
		const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`;
		n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`;
		document.body.appendChild(n);
		setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);
	}

	function setHelp(){
		const m=els.method?.value||'button';
		const help={
			button:'O usuário clica num botão para verificar. Requer permissões para enviar mensagens no canal.',
			image:'Gera um captcha de imagem. O bot precisa poder enviar imagens/anexos.',
			reaction:'O usuário reage à mensagem para verificar. Garanta que o bot pode adicionar reações.',
			form:'Formulário com perguntas. Requer configuração adicional (perguntas e critérios).'
		};
		if(els.methodHelp){ els.methodHelp.textContent = help[m] || ''; }
		if(els.formBuilder){
			const isForm = m==='form';
			els.formBuilder.classList.toggle('hidden', !isForm);
			els.formBuilder.setAttribute('aria-hidden', String(!isForm));
		}
		toggleOptionsEditor();
		renderPreview();
	}

	function toggleOptionsEditor(){
		const t = els.newQuestionType?.value || 'short_text';
		const requires = (t==='multiple_choice' || t==='dropdown');
		if(els.optionsEditor){ els.optionsEditor.classList.toggle('hidden', !requires); }
	}

	function renderOptions(list){
		if(!els.optionsList) return; els.optionsList.innerHTML='';
		list.forEach((opt,idx)=>{
			const li=document.createElement('li');
			li.innerHTML=`<span>${opt}</span><span class="actions"><button type="button" data-i="${idx}" class="btn btn-glass btn-xs del-opt"><i class="fas fa-trash"></i></button></span>`;
			els.optionsList.appendChild(li);
		});
		els.optionsList.querySelectorAll('.del-opt').forEach(btn=>{
			btn.addEventListener('click',()=>{
				const i=parseInt(btn.getAttribute('data-i'),10); if(Number.isFinite(i)){
					tempOptions.splice(i,1); renderOptions(tempOptions); updateDirty();
				}
			});
		});
	}

	let tempOptions=[];

	function renderQuestions(){
		if(!els.questionsList) return; els.questionsList.innerHTML='';
		questions.forEach((q,idx)=>{
			const typeMap={short_text:'Texto curto', long_text:'Texto longo', yes_no:'Sim/Não', multiple_choice:'Múltipla escolha', dropdown:'Dropdown'};
			const li=document.createElement('li');
			const badge = `<span class="badge" title="Tipo">${typeMap[q.type]||q.type}</span>`;
			const req = q.required ? '<span class="badge" title="Obrigatória">Obrigatória</span>' : '';
			const opts = Array.isArray(q.options) && q.options.length ? `<span class="badge" title="Opções">${q.options.length} opções</span>` : '';
			li.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong>${q.label}</strong> ${badge} ${req} ${opts}</div>
				<div class="actions">
					<button type="button" class="btn btn-glass btn-xs" data-act="up" data-i="${idx}"><i class="fas fa-arrow-up"></i></button>
					<button type="button" class="btn btn-glass btn-xs" data-act="down" data-i="${idx}"><i class="fas fa-arrow-down"></i></button>
					<button type="button" class="btn btn-glass btn-xs" data-act="edit" data-i="${idx}"><i class="fas fa-pen"></i></button>
					<button type="button" class="btn btn-glass btn-xs" data-act="del" data-i="${idx}"><i class="fas fa-trash"></i></button>
				</div>`;
			els.questionsList.appendChild(li);
		});
		els.questionsList.querySelectorAll('button[data-act]').forEach(btn=>{
			btn.addEventListener('click',()=>{
				const act=btn.getAttribute('data-act');
				const i=parseInt(btn.getAttribute('data-i'),10);
				if(!Number.isFinite(i)) return;
				if(act==='up' && i>0){ const t=questions[i-1]; questions[i-1]=questions[i]; questions[i]=t; renderQuestions(); updateDirty(); }
				else if(act==='down' && i<questions.length-1){ const t=questions[i+1]; questions[i+1]=questions[i]; questions[i]=t; renderQuestions(); updateDirty(); }
				else if(act==='del'){ questions.splice(i,1); renderQuestions(); updateDirty(); }
				else if(act==='edit'){ editQuestion(i); }
			});
		});
	}

	function editQuestion(i){
		const q = questions[i]; if(!q) return;
		els.newQuestionLabel.value = q.label;
		els.newQuestionType.value = q.type;
		els.newQuestionRequired.checked = !!q.required;
		tempOptions = Array.isArray(q.options) ? q.options.slice() : [];
		toggleOptionsEditor(); renderOptions(tempOptions);
		// Replace add with save
		els.addQuestion.textContent = 'Atualizar pergunta';
		els.addQuestion.setAttribute('data-editing', String(i));
	}

	function resetNewQuestion(){
		els.newQuestionLabel.value=''; els.newQuestionType.value='short_text'; els.newQuestionRequired.checked=false; tempOptions=[]; renderOptions(tempOptions); toggleOptionsEditor();
		els.addQuestion.textContent = 'Adicionar pergunta';
		els.addQuestion.removeAttribute('data-editing');
	}

	function validate(){
		const errors=[];
		const mode=els.mode?.value; const method=els.method?.value;
		const allowedModes=['easy','medium','hard']; const allowedMethods=['button','image','reaction','form'];
		if(!allowedModes.includes(mode)) errors.push('Selecione um modo válido');
		if(!allowedMethods.includes(method)) errors.push('Selecione um método válido');
		// Basic checks for color format if provided
		const color = (els.color?.value||'').trim();
		if(color && !/^#?[0-9a-fA-F]{6}$/.test(color)) errors.push('Cor inválida (use #RRGGBB)');
		if(method==='form'){
			if(!questions.length) errors.push('Adicione pelo menos 1 pergunta para o formulário');
			const tooMany = questions.length>20; if(tooMany) errors.push('Máximo 20 perguntas');
			for(const q of questions){
				if(!q.label || q.label.trim().length<1) { errors.push('Pergunta sem texto'); break; }
				if((q.type==='multiple_choice' || q.type==='dropdown')){
					if(!Array.isArray(q.options) || q.options.length<2) { errors.push(`"${q.label}" precisa de pelo menos 2 opções`); break; }
				}
			}
		}
		if(els.formError){ els.formError.style.display = errors.length? 'block':'none'; els.formError.textContent = errors.join(' • '); }
		updateDirty(errors);
		renderPreview();
	}

	function updateDirty(errors){
		const mode=els.mode?.value; const method=els.method?.value; const lf=!!els.logFails?.checked; const lr = parseInt(els.logFailRetention?.value||'7',10);
		const vr=els.verifiedRole?.value||''; const ur=els.unverifiedRole?.value||'';
		const cd = Math.max(0, Math.min(3600, parseInt(els.cooldownSeconds?.value||'0', 10) || 0));
		const changedBase = (original.mode!==mode) || (original.method!==method) || (Boolean(original.logFails)!==lf) || ((original.logFailRetention||7)!==lr) || ((original.verifiedRoleId||'')!==vr) || ((original.unverifiedRoleId||'')!==ur) || ((original.cooldownSeconds||0)!==cd);
		const formChanged = JSON.stringify(original.formQuestions||[]) !== JSON.stringify(questions||[]);
		const changed = changedBase || (method==='form' && formChanged);
		els.save && (els.save.disabled = (Array.isArray(errors) && errors.length>0) || !changed);
	}

	async function load(){
		try{
			const r=await fetch(`/api/guild/${guildId}/verification/config`, {credentials:'same-origin'});
			const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const c=d.config||{};
			original={ mode:c.mode||'easy', method:c.method||'button', cooldownSeconds: Number(c.cooldownSeconds||0), logFails:!!c.logFails, logFailRetention: c.logFailRetention||7, verifiedRoleId: c.verifiedRoleId||'', unverifiedRoleId: c.unverifiedRoleId||'', formQuestions: Array.isArray(c?.form?.questions)? c.form.questions : [] };
			questions = JSON.parse(JSON.stringify(original.formQuestions));
			if(els.mode) els.mode.value=original.mode; if(els.method) els.method.value=original.method; if(els.logFails) els.logFails.checked=original.logFails;
			if(els.logFailRetention){ els.logFailRetention.value = original.logFailRetention || 7; document.getElementById('retentionRow')?.classList.toggle('hidden', !original.logFails); }
			if(els.cooldownSeconds){ els.cooldownSeconds.value = String(original.cooldownSeconds||0); }
			// Load panel defaults
			const pd = (c && c.panelDefaults) || {};
			if(els.template) els.template.value = pd.template || 'minimal';
			if(els.title) els.title.value = pd.title || '';
			if(els.description) els.description.value = pd.description || '';
			if(els.buttonLabel) els.buttonLabel.value = pd.buttonLabel || '';
			if(els.color) els.color.value = pd.color || '#7C3AED';
			if(els.colorPicker) els.colorPicker.value = (pd.color || '#7C3AED');
			// Fill roles/channels if empty
			await Promise.all([loadRoles(), loadChannels()]);
			if(els.verifiedRole && original.verifiedRoleId) els.verifiedRole.value = original.verifiedRoleId;
			if(els.unverifiedRole && original.unverifiedRoleId) els.unverifiedRole.value = original.unverifiedRoleId;
			setHelp(); renderQuestions(); validate();
			// Initial metrics/logs fetch
			await refreshMetrics();
			await refreshLogs();
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}

	async function loadRoles(){
		try{ const r=await fetch(`/api/guild/${guildId}/roles`, {credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const list = d.roles||[]; const opts = ['<option value="">—</option>'].concat(list.map(r=>`<option value="${r.id}">${r.name}</option>`)).join('');
			if(els.verifiedRole) els.verifiedRole.innerHTML = opts; if(els.unverifiedRole) els.unverifiedRole.innerHTML = opts;
		}catch{}
	}

	async function loadChannels(){
		try{ const r=await fetch(`/api/guild/${guildId}/channels`, {credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const list = d.channels||[]; const opts = ['<option value="">—</option>'].concat(list.map(c=>`<option value="${c.id}">${c.name}</option>`)).join('');
			if(els.panelChannel) els.panelChannel.innerHTML = opts;
		}catch{}
	}

	async function save(){
		try{
			validate(); if(els.save?.disabled) return; els.save.disabled=true;
			const method = els.method?.value || 'button';
			const lr = parseInt(els.logFailRetention?.value||'7',10);
			const cd = Math.max(0, Math.min(3600, parseInt(els.cooldownSeconds?.value||'0', 10) || 0));
			const body = { mode:els.mode?.value||'easy', method, cooldownSeconds: cd, logFails:!!els.logFails?.checked };
			if(body.logFails) body.logFailRetention = Math.max(1, Math.min(90, lr));
			const vr = els.verifiedRole?.value||''; const ur = els.unverifiedRole?.value||'';
			if(vr) body.verifiedRoleId = vr; if(ur) body.unverifiedRoleId = ur;
			if(method==='form') body.form = { questions: questions.map(q=>({ id:q.id, label:q.label, type:q.type, required:!!q.required, options: Array.isArray(q.options)? q.options: undefined })) };
			const r=await fetch(`/api/guild/${guildId}/verification/config`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(body)});
			const d=await r.json(); if(!r.ok||!d.success) throw new Error(Array.isArray(d.details)? d.details.join(' • ') : (d.error||`HTTP ${r.status}`));
			const c=d.config||body; // prefer server-config back
			original={ mode:c.mode||body.mode, method:c.method||body.method, cooldownSeconds: Number(c.cooldownSeconds||body.cooldownSeconds||0), logFails:!!c.logFails, logFailRetention:c.logFailRetention||body.logFailRetention||7, verifiedRoleId:c.verifiedRoleId||vr||'', unverifiedRoleId:c.unverifiedRoleId||ur||'', formQuestions: (c.form?.questions)||(body.form?.questions)||[] };
			notify('Guardado','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
		finally{ validate(); }
	}

	function updateRetentionVisibility(){
		const enabled = !!els.logFails?.checked; const row = document.getElementById('retentionRow'); if(row) row.classList.toggle('hidden', !enabled);
	}

	// Events
	els.template?.addEventListener('change', ()=>{ validate(); });
	els.mode?.addEventListener('change', ()=>{ setHelp(); validate(); });
	els.method?.addEventListener('change', ()=>{ setHelp(); validate(); });
	els.cooldownSeconds?.addEventListener('input', ()=> validate());
	els.logFails?.addEventListener('change', ()=> { updateRetentionVisibility(); validate(); });
	els.logFailRetention?.addEventListener('input', ()=> validate());
	els.verifiedRole?.addEventListener('change', ()=> validate());
	els.unverifiedRole?.addEventListener('change', ()=> validate());
	els.title?.addEventListener('input', ()=> validate());
	els.description?.addEventListener('input', ()=> validate());
	els.buttonLabel?.addEventListener('input', ()=> validate());
	els.color?.addEventListener('input', ()=>{
		const v=(els.color?.value||'').trim();
		if(/^#?[0-9a-fA-F]{6}$/.test(v)){
			const hex=v.startsWith('#')? v : ('#'+v);
			if(els.colorPicker) els.colorPicker.value = hex;
		}
		validate();
	});
	els.colorPicker?.addEventListener('input', ()=>{
		const v = els.colorPicker?.value||'';
		if(els.color) els.color.value = v;
		validate();
	});
	els.save?.addEventListener('click', save);

	// Save panel defaults only
	async function saveDefaults(){
		try{
			const tpl = els.template?.value || 'minimal';
			let color = (els.color?.value||'').trim();
			if(color && !color.startsWith('#')) color = '#'+color;
			const body = { panelDefaults: {
				template: ['minimal','rich'].includes(tpl) ? tpl : 'minimal',
				title: (els.title?.value||'').trim() || '',
				description: (els.description?.value||'').trim() || '',
				buttonLabel: (els.buttonLabel?.value||'').trim() || '',
				color: (/^#?[0-9a-fA-F]{6}$/.test((color||'').replace('#',''))) ? color : undefined
			}}
			const r = await fetch(`/api/guild/${guildId}/verification/config`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(body)});
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(Array.isArray(d.details)? d.details.join(' • ') : (d.error||`HTTP ${r.status}`));
			notify('Padrões do painel guardados','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
		finally{ validate(); }
	}
	const btnSaveDefaults = document.getElementById('saveDefaults');
	btnSaveDefaults?.addEventListener('click', saveDefaults);

	// Reset/clear saved panel defaults
	async function resetDefaults(){
		try{
			const r = await fetch(`/api/guild/${guildId}/verification/config`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ panelDefaults: { clear: true } })});
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			notify('Padrões do painel limpos','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
		finally{ validate(); }
	}
	const btnResetDefaults = document.getElementById('resetDefaults');
	btnResetDefaults?.addEventListener('click', resetDefaults);

	// Add toggle to use saved defaults when creating a panel
	let useSavedDefaults = true; // default ON for convenience
	(function addUseDefaultsToggle(){
		try{
			const container = document.getElementById('previewCard');
			if(!container) return;
			const wrap = document.createElement('div');
			wrap.className = 'mt-8';
			wrap.innerHTML = `
				<label class="switch" title="Usar padrões guardados para o próximo painel">
					<input id="useSavedDefaults" type="checkbox" checked />
					<span>Usar padrões guardados neste painel</span>
				</label>`;
			container.appendChild(wrap);
			document.getElementById('useSavedDefaults')?.addEventListener('change', (e)=>{
				useSavedDefaults = !!e.target.checked;
			});
		}catch{}
	})();

	els.newQuestionType?.addEventListener('change', ()=>{ toggleOptionsEditor(); });
	els.addOption?.addEventListener('click', ()=>{
		const val=(els.newOptionText?.value||'').trim(); if(!val) return; if(tempOptions.includes(val)) return; if(tempOptions.length>=25) { notify('Máximo 25 opções','error'); return; }
		tempOptions.push(val); els.newOptionText.value=''; renderOptions(tempOptions); updateDirty();
	});
	els.addQuestion?.addEventListener('click', ()=>{
		const label=(els.newQuestionLabel?.value||'').trim(); const type=els.newQuestionType?.value||'short_text'; const required=!!els.newQuestionRequired?.checked;
		if(!label){ notify('Escreva a pergunta','error'); return; }
		let q={ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, label, type, required };
		if(type==='multiple_choice' || type==='dropdown'){
			if(tempOptions.length<2){ notify('Adicione pelo menos 2 opções','error'); return; }
			q.options = tempOptions.slice();
		}
		const editing = els.addQuestion.getAttribute('data-editing');
		if(editing!=null){ const i=parseInt(editing,10); if(Number.isFinite(i)) questions[i]=q; els.addQuestion.removeAttribute('data-editing'); els.addQuestion.textContent='Adicionar pergunta'; }
		else { questions.push(q); }
		renderQuestions(); resetNewQuestion(); updateDirty(); validate();
	});

	// Create verification panel
	async function createPanel(){
		try{
			// Prevent double-clicks
			if(els.createPanel){
				if(els.createPanel.dataset.loading === '1') return; // already in-flight
				els.createPanel.dataset.loading = '1';
				els.createPanel.disabled = true;
				els.createPanel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A criar...';
			}
			const ch = els.panelChannel?.value||''; if(!ch) { notify('Selecione um canal para publicar o painel','error'); return; }
			const body = { type:'verification', channel_id: ch, theme: 'dark' };
			// Attach template and options unless toggle is ON, in which case we omit to use saved defaults
			if(!useSavedDefaults){
				const tpl = (els.template?.value||'minimal');
				body.template = tpl;
				body.options = {
					title: (els.title?.value||'').trim() || undefined,
					description: (els.description?.value||'').trim() || undefined,
					buttonLabel: (els.buttonLabel?.value||'').trim() || undefined,
					color: (els.color?.value||'').trim() || undefined
				};
			}
			// Include a simple idempotency key per click to help server de-dup (best-effort)
			const idemKey = `ver:${guildId}:${ch}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
			const r = await fetch(`/api/guild/${guildId}/panels/create`, { method:'POST', headers:{'Content-Type':'application/json','X-Idempotency-Key': idemKey}, credentials:'same-origin', body: JSON.stringify(body)});
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			notify('Painel de verificação criado','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
		finally{
			if(els.createPanel){
				els.createPanel.dataset.loading = '0';
				els.createPanel.disabled = false;
				els.createPanel.innerHTML = '<i class="fas fa-plus"></i> Criar Painel de Verificação';
			}
		}
	}
	els.createPanel?.addEventListener('click', createPanel);

	// Metrics
	async function refreshMetrics(){
		try{
			const win = els.metricsWindow?.value || '24h';
			const r = await fetch(`/api/guild/${guildId}/verification/metrics?window=${encodeURIComponent(win)}`, { credentials:'same-origin' });
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const m = d.metrics || { success:0, fail:0, byMethod:{}, failReasons:{} };
			if(els.metricSuccess) els.metricSuccess.textContent = String(m.success||0);
			if(els.metricFail) els.metricFail.textContent = String(m.fail||0);
			if(els.metricTotal) els.metricTotal.textContent = String((m.success||0)+(m.fail||0));
			if(els.byMethodList){
				els.byMethodList.innerHTML='';
				const entries = Object.entries(m.byMethod||{}).sort((a,b)=>b[1]-a[1]);
				for(const [k,v] of entries){
					const li=document.createElement('li');
					li.innerHTML = `<span>${k}</span><span class="badge">${v}</span>`;
					els.byMethodList.appendChild(li);
				}
				if(entries.length===0){ els.byMethodList.innerHTML = '<li><span class="text-secondary">Sem dados</span></li>'; }
			}
			if(els.failReasonsList){
				els.failReasonsList.innerHTML='';
				const entries = Object.entries(m.failReasons||{}).sort((a,b)=>b[1]-a[1]);
				for(const [k,v] of entries){
					const li=document.createElement('li');
					li.innerHTML = `<span>${k}</span><span class="badge">${v}</span>`;
					els.failReasonsList.appendChild(li);
				}
				if(entries.length===0){ els.failReasonsList.innerHTML = '<li><span class="text-secondary">Sem dados</span></li>'; }
			}
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}
	els.metricsWindow?.addEventListener('change', refreshMetrics);
	els.metricsRefresh?.addEventListener('click', refreshMetrics);

	// Logs
	async function refreshLogs(){
		try{
			const r = await fetch(`/api/guild/${guildId}/verification/logs?limit=200`, { credentials:'same-origin' });
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const list = Array.isArray(d.logs) ? d.logs : [];
			if(els.logsList){
				els.logsList.innerHTML='';
				for(const log of list){
					const ts = new Date(log.timestamp).toLocaleString();
					const li=document.createElement('li');
					const icon = log.type === 'verification_success' ? '<i class="fas fa-check-circle" style="color:#22c55e"></i>' : '<i class="fas fa-times-circle" style="color:#ef4444"></i>';
					li.innerHTML = `<div class="flex-row align-center"><span>${icon}</span><strong style="margin-left:6px">${log.type}</strong><span class="badge" style="margin-left:6px">${log.message||'-'}</span></div><div class="text-secondary small">${ts}</div>`;
					els.logsList.appendChild(li);
				}
				if(list.length===0){ els.logsList.innerHTML = '<li><span class="text-secondary">Sem logs</span></li>'; }
			}
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}
	async function exportLogs(){
		try{
			const r = await fetch(`/api/guild/${guildId}/verification/logs?limit=1000`, { credentials:'same-origin' });
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const blob = new Blob([JSON.stringify(d.logs||[], null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = `verification-logs-${guildId}.json`;
			document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}
	async function pruneLogs(){
		try{
			const days = Math.max(1, Math.min(365, parseInt(els.pruneDays?.value||'30', 10) || 30));
			const r = await fetch(`/api/guild/${guildId}/verification/logs?olderThanDays=${encodeURIComponent(days)}`, { method:'DELETE', credentials:'same-origin' });
			const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			notify('Logs limpos','success');
			refreshLogs();
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}
	els.exportLogs?.addEventListener('click', exportLogs);
	els.pruneLogs?.addEventListener('click', pruneLogs);

	function renderPreview(){
		const method = els.method?.value || 'button';
		const title = (els.title?.value||'').trim() || '🔒 Verificação do Servidor';
		const desc = (els.description?.value||'').trim() || (method==='reaction' ? 'Reage com ✅ nesta mensagem para te verificares.' : 'Clica em Verificar para concluir e ganhar acesso aos canais.');
		const btn = (els.buttonLabel?.value||'').trim() || 'Verificar';
		let color = (els.color?.value||'#7C3AED').trim();
		if(!/^#?[0-9a-fA-F]{6}$/.test(color)) color = '#7C3AED';
		if(!color.startsWith('#')) color = '#'+color;
		const pe = document.getElementById('previewEmbed');
		const pt = document.getElementById('previewTitle');
		const pd = document.getElementById('previewDesc');
		const pb = document.getElementById('previewButton');
		const pr = document.getElementById('previewReaction');
		if(pe){ pe.style.borderLeftColor = color; }
		if(pt) pt.textContent = title;
		if(pd) pd.textContent = desc;
		if(pb) pb.classList.toggle('hidden', method==='reaction');
		if(pb) { const b = pb.querySelector('button'); if(b){ b.innerHTML = `<i class="fas fa-check"></i> ${btn}`; } }
		if(pr) pr.classList.toggle('hidden', method!=='reaction');
	}

	load();
})();