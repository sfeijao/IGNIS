'use client';

import TicketCategoryManager from '@/components/TicketCategoryManager';
import { useGuildId } from '@/lib/guild';

export default function TicketCategoriesPage() {
  const guildId = useGuildId();

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
