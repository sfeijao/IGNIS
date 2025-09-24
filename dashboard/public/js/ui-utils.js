(function(){
  function ensureModal(){
    let modal=document.getElementById('uiConfirmModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='uiConfirmModal';
    modal.className='modal';
    modal.setAttribute('aria-hidden','true');
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-header"><h3 id="uiModalTitle">Confirmar</h3></div>
        <div class="modal-body" id="uiModalBody">Tem a certeza?</div>
        <div class="modal-footer">
          <button id="uiModalCancel" class="btn btn-glass">Cancelar</button>
          <button id="uiModalOk" class="btn btn-danger"><i class="fas fa-trash"></i> Confirmar</button>
        </div>
      </div>`;
    const style=document.createElement('style');
    style.textContent = `.modal{position:fixed;inset:0;z-index:1000}.modal[aria-hidden="true"]{display:none}.modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.4)}.modal-dialog{position:relative;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;margin:10vh auto;max-width:420px;padding:16px}.modal-header{font-weight:600;margin-bottom:8px}.modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}`;
    document.head.appendChild(style);
    document.body.appendChild(modal);
    return modal;
  }

  async function confirm(message){
    try{
      const modal=ensureModal();
      const body=modal.querySelector('#uiModalBody');
      const ok=modal.querySelector('#uiModalOk');
      const cancel=modal.querySelector('#uiModalCancel');
      body.textContent = message;
      modal.setAttribute('aria-hidden','false');
      return await new Promise(resolve=>{
        const cleanup=()=>{
          modal.setAttribute('aria-hidden','true');
          ok.removeEventListener('click', onOk);
          cancel.removeEventListener('click', onCancel);
          modal.removeEventListener('click', onBackdrop);
        };
        const onOk=()=>{ cleanup(); resolve(true); };
        const onCancel=()=>{ cleanup(); resolve(false); };
        const onBackdrop=(e)=>{ if(e.target===modal.querySelector('.modal-backdrop')){ onCancel(); } };
        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
      });
    }catch{ return Promise.resolve(window.confirm(message)); }
  }

  window.UI = Object.assign(window.UI||{}, { confirm });
})();
