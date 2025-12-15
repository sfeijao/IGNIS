'use client';

import TicketCategoryManager from '@/components/TicketCategoryManager';
import { useGuildIdWithLoading } from '@/lib/guild';

export default function TicketCategoriesPage() {
  const { guildId, loading } = useGuildIdWithLoading();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!guildId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Nenhum servidor selecionado</h1>
          <p className="text-gray-400">Selecione um servidor para gerir as categorias de tickets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <TicketCategoryManager guildId={guildId} />
    </div>
  );
}
