'use client';

import { useState } from 'react';
import { useGuildIdWithLoading } from '@/lib/guild';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface TicketCategory {
  _id: string;
  name: string;
  description: string;
  emoji: string;
  channelSettings: {
    categoryChannelId?: string;
    namingPattern: string;
    privateChannel: boolean;
  };
  staffSettings: {
    roleIds: string[];
    autoAssign: boolean;
    notifyOnCreate: boolean;
    notificationChannelId?: string;
  };
  requireReason: boolean;
  maxOpenPerUser: number;
  enabled: boolean;
  stats: {
    totalTickets: number;
    averageResponseTime: number;
    averageResolutionTime: number;
  };
}

export default function TicketCategoriesPage() {
  const { guildId, loading: guildLoading } = useGuildIdWithLoading();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    emoji: '🎫',
    namingPattern: 'ticket-{number}',
    maxOpenPerUser: 1,
    requireReason: false,
    enabled: true
  });

  const { data, loading, error, refetch } = useSafeAPI<TicketCategory[]>(
    async () => {
      const res = await safeFetch<{ categories: TicketCategory[] }>(`/api/guild/${guildId}/ticket-categories`);
      return res.categories || [];
    },
    [guildId],
    { skip: !guildId }
  );

  const categories = data || [];

  const saveCategory = async () => {
    try {
      const url = editingId
        ? `/api/guild/${guildId}/ticket-categories/${editingId}`
        : `/api/guild/${guildId}/ticket-categories`;

      await safeFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', description: '', emoji: '🎫', namingPattern: 'ticket-{number}', maxOpenPerUser: 1, requireReason: false, enabled: true });
      refetch();
      alert('✅ Categoria salva!');
    } catch (error) {
      alert(`❌ Erro: ${error instanceof Error ? error.message : 'Falha ao salvar'}`);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Deletar esta categoria?')) return;
    try {
      await safeFetch(`/api/guild/${guildId}/ticket-categories/${id}`, { method: 'DELETE' });
      refetch();
      alert('✅ Categoria deletada!');
    } catch (error) {
      alert(`❌ Erro: ${error instanceof Error ? error.message : 'Falha ao deletar'}`);
    }
  };

  const editCategory = (category: TicketCategory) => {
    setEditingId(category._id);
    setFormData({
      name: category.name,
      description: category.description,
      emoji: category.emoji,
      namingPattern: category.channelSettings.namingPattern,
      maxOpenPerUser: category.maxOpenPerUser,
      requireReason: category.requireReason,
      enabled: category.enabled
    });
    setShowModal(true);
  };

  if (guildLoading) {
    return <LoadingState message="Carregando..." />;
  }

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar categorias de tickets" />;
  }

  if (loading) {
    return <LoadingState message="Carregando categorias..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🏷️ Categorias de Tickets</h1>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700">
            ➕ Nova Categoria
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.length === 0 ? (
            <div className="col-span-full bg-gray-800/50 rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400">Nenhuma categoria configurada</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat._id} className={`bg-gray-800/50 rounded-lg p-6 border ${cat.enabled ? 'border-purple-500/30' : 'border-gray-500/30'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{cat.emoji}</span>
                    <div>
                      <h3 className="text-white font-bold text-xl">{cat.name}</h3>
                      <p className="text-gray-400 text-sm">{cat.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${cat.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}`}>
                    {cat.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <p className="text-gray-300">📊 Total Tickets: <span className="text-white font-semibold">{cat.stats.totalTickets}</span></p>
                  <p className="text-gray-300">⏱️ Tempo Resposta: <span className="text-white font-semibold">{cat.stats.averageResponseTime}min</span></p>
                  <p className="text-gray-300">✅ Tempo Resolução: <span className="text-white font-semibold">{cat.stats.averageResolutionTime}min</span></p>
                  <p className="text-gray-300">🔢 Padrão Nome: <span className="text-white font-mono text-xs">{cat.channelSettings.namingPattern}</span></p>
                  <p className="text-gray-300">👤 Limite/Usuário: <span className="text-white font-semibold">{cat.maxOpenPerUser}</span></p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => editCategory(cat)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
                    ✏️ Editar
                  </button>
                  <button onClick={() => deleteCategory(cat._id)} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm">
                    🗑️ Deletar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">{editingId ? 'Editar' : 'Nova'} Categoria</h2>
              <div className="space-y-4">
                <div><label className="block text-white mb-2">Nome</label><input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Descrição</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg h-20"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-white mb-2">Emoji</label><input type="text" value={formData.emoji} onChange={(e) => setFormData({...formData, emoji: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                  <div><label className="block text-white mb-2">Max Tickets/Usuário</label><input type="number" value={formData.maxOpenPerUser} onChange={(e) => setFormData({...formData, maxOpenPerUser: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                </div>
                <div><label className="block text-white mb-2">Padrão de Nome</label><input type="text" value={formData.namingPattern} onChange={(e) => setFormData({...formData, namingPattern: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg" placeholder="ticket-{number}"/><p className="text-gray-400 text-xs mt-1">Use {'{number}'} para número sequencial</p></div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-3 cursor-pointer text-white">
                    <input type="checkbox" checked={formData.requireReason} onChange={(e) => setFormData({...formData, requireReason: e.target.checked})} className="w-5 h-5"/>
                    Exigir Motivo
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-white">
                    <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} className="w-5 h-5"/>
                    Ativo
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={saveCategory} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg">Salvar</button>
                  <button onClick={() => {setShowModal(false); setEditingId(null);}} className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-lg">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
