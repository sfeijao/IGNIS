import { useParams } from 'next/navigation'

/**
 * Hook para obter o guildId da URL
 * Usado em páginas dinâmicas /guild/[guildId]/...
 */
export function useGuildId(): string | null {
  const params = useParams()
  return (params?.guildId as string) || null
}
