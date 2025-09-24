(function(){
	const p=new URLSearchParams(window.location.search);
	const guildId=p.get('guildId');
	const els={
		mode:document.getElementById('mode'),
		method:document.getElementById('method'),
		logFails:document.getElementById('logFails'),
		save:document.getElementById('save'),
		formError:document.getElementById('formError'),
		methodHelp:document.getElementById('methodHelp'),
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
	}

	function updateDirty(errors){
		const mode=els.mode?.value; const method=els.method?.value; const lf=!!els.logFails?.checked;
		const changedBase = (original.mode!==mode) || (original.method!==method) || (Boolean(original.logFails)!==lf);
		const formChanged = JSON.stringify(original.formQuestions||[]) !== JSON.stringify(questions||[]);
		const changed = changedBase || (method==='form' && formChanged);
		els.save && (els.save.disabled = (Array.isArray(errors) && errors.length>0) || !changed);
	}

	async function load(){
		try{
			const r=await fetch(`/api/guild/${guildId}/verification/config`, {credentials:'same-origin'});
			const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			const c=d.config||{};
			original={ mode:c.mode||'easy', method:c.method||'button', logFails:!!c.logFails, formQuestions: Array.isArray(c?.form?.questions)? c.form.questions : [] };
			questions = JSON.parse(JSON.stringify(original.formQuestions));
			if(els.mode) els.mode.value=original.mode; if(els.method) els.method.value=original.method; if(els.logFails) els.logFails.checked=original.logFails;
			setHelp(); renderQuestions(); validate();
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}

	async function save(){
		try{
			validate(); if(els.save?.disabled) return; els.save.disabled=true;
			const method = els.method?.value || 'button';
			const body = { mode:els.mode?.value||'easy', method, logFails:!!els.logFails?.checked };
			if(method==='form') body.form = { questions: questions.map(q=>({ id:q.id, label:q.label, type:q.type, required:!!q.required, options: Array.isArray(q.options)? q.options: undefined })) };
			const r=await fetch(`/api/guild/${guildId}/verification/config`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(body)});
			const d=await r.json(); if(!r.ok||!d.success) throw new Error(Array.isArray(d.details)? d.details.join(' • ') : (d.error||`HTTP ${r.status}`));
			original={ mode:body.mode, method:body.method, logFails:body.logFails, formQuestions: (body.form?.questions)||[] };
			notify('Guardado','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
		finally{ validate(); }
	}

	// Events
	els.mode?.addEventListener('change', ()=>{ setHelp(); validate(); });
	els.method?.addEventListener('change', ()=>{ setHelp(); validate(); });
	els.logFails?.addEventListener('change', ()=> validate());
	els.save?.addEventListener('click', save);

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

	load();
})();