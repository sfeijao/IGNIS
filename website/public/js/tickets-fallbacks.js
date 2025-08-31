// Fallbacks for ticket page helper functions that may be missing in some builds.
(function(){
  if (window._ticketsFallbacksInstalled) return; window._ticketsFallbacksInstalled = true;

  window.exportTickets = window.exportTickets || function(){
    try { window.showToast && window.showToast('Exportar tickets não implementado.', 4000); } catch(_){ }
    return false;
  };

  // Backwards-compatible alias used by older/front-end pages
  window.exportArchivedTickets = window.exportArchivedTickets || function() {
    try { window.showToast && window.showToast('Iniciando exportação (fallback)...', 3000); } catch(_){}
    try {
      // Try to trigger the server export endpoint. On dev localhost this will work.
      window.location.href = '/api/tickets/export?status=archived';
    } catch (_) {}
    return false;
  };

  window.ticketSettings = window.ticketSettings || function(){
    try { window.showToast && window.showToast('Configurações de tickets não disponível.', 4000); } catch(_){}
  };

})();
