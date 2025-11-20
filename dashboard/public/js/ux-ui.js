/**
 * ✨ IGNIS UX/UI JavaScript Library
 *
 * Fornece componentes reutilizáveis para:
 * - Toast notifications
 * - Modal system
 * - Loading states
 * - Animations
 */

(function(window) {
  'use strict';

  const IGNIS_UI = {};

  // ══════════════════════════════════════════════════
  // 🍞 TOAST SYSTEM
  // ══════════════════════════════════════════════════

  let toastContainer = null;
  let toastIdCounter = 0;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  const TOAST_ICONS = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  IGNIS_UI.toast = function(options) {
    const {
      type = 'info',
      title = '',
      message = '',
      duration = 4000,
      dismissible = true
    } = typeof options === 'string' ? { message: options } : options;

    const container = ensureToastContainer();
    const id = `toast-${toastIdCounter++}`;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.id = id;
    toast.setAttribute('role', 'alert');

    const iconClass = TOAST_ICONS[type] || TOAST_ICONS.info;

    toast.innerHTML = `
      <div class="toast-icon">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
        ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
      </div>
      ${dismissible ? '<button class="toast-close" aria-label="Fechar"><i class="fas fa-times"></i></button>' : ''}
    `;

    const close = () => {
      toast.classList.add('toast-closing');
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
          toastContainer = null;
        }
      }, 300);
    };

    if (dismissible) {
      const closeBtn = toast.querySelector('.toast-close');
      closeBtn?.addEventListener('click', close);
    }

    toast.addEventListener('click', (e) => {
      if (!e.target.closest('.toast-close')) {
        close();
      }
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(close, duration);
    }

    return { close, element: toast };
  };

  // Shortcuts
  IGNIS_UI.toast.success = (msg, title) => IGNIS_UI.toast({ type: 'success', message: msg, title });
  IGNIS_UI.toast.error = (msg, title) => IGNIS_UI.toast({ type: 'error', message: msg, title });
  IGNIS_UI.toast.warning = (msg, title) => IGNIS_UI.toast({ type: 'warning', message: msg, title });
  IGNIS_UI.toast.info = (msg, title) => IGNIS_UI.toast({ type: 'info', message: msg, title });

  // ══════════════════════════════════════════════════
  // 🎭 MODAL SYSTEM
  // ══════════════════════════════════════════════════

  let modalIdCounter = 0;

  IGNIS_UI.modal = function(options) {
    const {
      title = 'Modal',
      content = '',
      buttons = [],
      onClose = null,
      closeOnOverlay = true,
      closeOnEscape = true
    } = options;

    const id = `modal-${modalIdCounter++}`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = id;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${id}-title`);

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2 class="modal-title" id="${id}-title">${escapeHtml(title)}</h2>
      <button class="modal-close" aria-label="Fechar">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const close = () => {
      overlay.classList.add('modal-closing');
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = '';
        if (onClose) onClose();
      }, 200);
    };

    // Default buttons if none provided
    const btnConfigs = buttons.length > 0 ? buttons : [
      { label: 'Fechar', style: 'btn-glass', onClick: close }
    ];

    btnConfigs.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.style || 'btn-glass'}`;
      btn.textContent = btnConfig.label;
      btn.addEventListener('click', () => {
        if (btnConfig.onClick) {
          btnConfig.onClick(close);
        } else {
          close();
        }
      });
      footer.appendChild(btn);
    });

    // Assemble
    modal.appendChild(header);
    modal.appendChild(body);
    if (btnConfigs.length > 0) modal.appendChild(footer);
    overlay.appendChild(modal);

    // Close button
    header.querySelector('.modal-close').addEventListener('click', close);

    // Close on overlay click
    if (closeOnOverlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    // Close on Escape
    if (closeOnEscape) {
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          close();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    document.body.appendChild(overlay);

    // Focus trap
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return { close, overlay, modal };
  };

  IGNIS_UI.modal.confirm = function(options) {
    const {
      title = 'Confirmar',
      message = 'Tem a certeza?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      onConfirm = null,
      onCancel = null
    } = typeof options === 'string' ? { message: options } : options;

    return IGNIS_UI.modal({
      title,
      content: `<p style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(message)}</p>`,
      buttons: [
        {
          label: cancelText,
          style: 'btn-glass',
          onClick: (close) => {
            if (onCancel) onCancel();
            close();
          }
        },
        {
          label: confirmText,
          style: 'btn-primary',
          onClick: (close) => {
            if (onConfirm) onConfirm();
            close();
          }
        }
      ]
    });
  };

  // ══════════════════════════════════════════════════
  // ⏳ LOADING STATES
  // ══════════════════════════════════════════════════

  IGNIS_UI.loading = {
    show: function(target) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      if (!element) return;

      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-label', 'A carregar...');

      element.innerHTML = '';
      element.appendChild(spinner);
      element.style.textAlign = 'center';
      element.style.padding = '40px';
    },

    skeleton: function(target, count = 3, height = '80px') {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      if (!element) return;

      element.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton';
        skeleton.style.height = height;
        skeleton.style.marginBottom = '12px';
        element.appendChild(skeleton);
      }
    }
  };

  // ══════════════════════════════════════════════════
  // 🎨 UTILITIES
  // ══════════════════════════════════════════════════

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Animation helpers
  IGNIS_UI.animate = {
    fadeIn: (element, duration = 300) => {
      element.style.animation = `fadeIn ${duration}ms ease`;
    },
    slideUp: (element, duration = 400) => {
      element.style.animation = `slideUp ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    },
    pulse: (element) => {
      element.classList.add('pulse');
      setTimeout(() => element.classList.remove('pulse'), 2000);
    }
  };

  // Export globally
  window.IGNIS_UI = IGNIS_UI;

  // Também manter compatibilidade com funções antigas
  window.notify = function(msg, type = 'info') {
    IGNIS_UI.toast({ type, message: msg });
  };

})(window);
