export function getGuildId(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const param = url.searchParams.get('guildId')
  if (param) return param
  const saved = localStorage.getItem('guildId')
  return saved
}

export function setGuildId(id: string, updateUrl: boolean = true) {
  if (typeof window === 'undefined') return
  const trimmed = (id || '').trim()
  if (trimmed) {
    localStorage.setItem('guildId', trimmed)
  } else {
    localStorage.removeItem('guildId')
  }
  if (updateUrl) {
    try {
      const url = new URL(window.location.href)
      if (trimmed) url.searchParams.set('guildId', trimmed)
      else url.searchParams.delete('guildId')
      window.history.replaceState({}, '', url.toString())
    } catch {}
  }
}
