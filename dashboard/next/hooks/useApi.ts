"use client"

import { useCallback } from 'react'

export function useApi() {
  const request = useCallback(async <T = any>(input: RequestInfo | URL, init?: RequestInit & { parseJson?: boolean }) => {
    const opts: RequestInit = { credentials: 'include', ...init }
    try {
      const res = await fetch(input, opts)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed: ${res.status}`)
      }
      if (init?.parseJson === false) return (await res.text()) as any as T
      return (await res.json()) as T
    } catch (e: any) {
      console.warn('API request error', { input, error: e?.message || e })
      throw e
    }
  }, [])

  return { request }
}
