"use client"

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; title?: string; description?: string; type?: ToastType }

type ToastContextType = {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToasterProvider />')
  return ctx
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Use a purely incremental id that does NOT embed Date.now() to avoid any chance of
  // server/client divergence during hydration. The initial SSR pass (empty array) will
  // still match the client, and subsequent IDs are deterministic within the session.
  const idSeq = useRef(0)

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(idSeq.current++)
    const next: Toast = { id, ...t }
    setToasts(prev => [...prev, next])
    // auto-dismiss after 4.5s
    if (typeof window !== 'undefined') {
      window.setTimeout(() => remove(id), 4500)
    }
  }, [remove])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Viewport */}
      <div className="fixed z-50 right-4 bottom-4 flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl border p-3 shadow-lg backdrop-blur card ${
            t.type === 'success' ? 'border-emerald-700/60' : t.type === 'error' ? 'border-rose-700/60' : 'border-neutral-700/60'
          }`}>
            {t.title && <div className="text-sm font-semibold mb-0.5">{t.title}</div>}
            {t.description && <div className="text-xs text-neutral-300">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
