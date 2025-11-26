'use client';

import { useState } from 'react';
import { useGuildId } from '@/hooks/useGuildId';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface AutoResponse {
  _id: string;
  name: string;
  triggers: string[];
  response: string;
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  caseSensitive: boolean;
  cooldown: number;
  enabled: boolean;
  stats: {
    totalTriggers: number;
    lastTriggeredAt?: Date;
  };
}

export default function AutoResponderPage() {
  const guildId = useGuildId();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    triggers: string;
    response: string;
    matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    caseSensitive: boolean;
    cooldown: number;
  }>({
    name: '',
    triggers: '',
    response: '',
    matchType: 'contains',
    caseSensitive: false,
    cooldown: 0
  });

  const { data, loading, error, refetch } = useSafeAPI<{ success: boolean; responses: AutoResponse[] }>(
    () => safeFetch(`/api/guild/${guildId}/autoresponses`),
    [guildId],
    { skip: !guildId }
  );

  const responses = data?.responses || [];

  const saveResponse = async () => {
    const payload = {
      ...formData,
      triggers: formData.triggers.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      const url = editingId
        ? `/api/guild/${guildId}/autoresponses/${editingId}`
        : `/api/guild/${guildId}/autoresponses`;

      await safeFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', triggers: '', response: '', matchType: 'contains', caseSensitive: false, cooldown: 0 });
      refetch();
      alert('✅ Resposta salva!');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao salvar'}`);
    }
  };

  const deleteResponse = async (id: string) => {
    if (!confirm('Deletar esta resposta automática?')) return;
    try {
      await safeFetch(`/api/guild/${guildId}/autoresponses/${id}`, {
        method: 'DELETE'
      });
      refetch();
      alert('✅ Resposta deletada!');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao deletar'}`);
    }
  };

  const editResponse = (response: AutoResponse) => {
    setEditingId(response._id);
    setFormData({
      name: response.name,
      triggers: response.triggers.join(', '),
      response: response.response,
      matchType: response.matchType,
      caseSensitive: response.caseSensitive,
      cooldown: response.cooldown
    });
    setShowModal(true);
  };

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar auto-respostas" />;
  }

  if (loading) {
    return <LoadingState message="Carregando auto-respostas..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🤖 Auto-Responder</h1>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700">
            ➕ Nova Resposta
          </button>
        </div>

        <div className="space-y-4">
          {responses.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400">Nenhuma resposta automática configurada</p>
            </div>
          ) : (
            responses.map((r) => (
              <div key={r._id} className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-xl mb-2">{r.name}</h3>
                    <div className="flex gap-2 mb-2">
                      {r.triggers.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-600 text-white text-sm rounded">{t}</span>
                      ))}
                    </div>
                    <p className="text-gray-300 mb-2">"{r.response}"</p>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Tipo: {r.matchType}</span>
                      <span>Cooldown: {r.cooldown}s</span>
                      <span>Triggers: {r.stats.totalTriggers}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editResponse(r)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✏️ Editar</button>
                    <button onClick={() => deleteResponse(r._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">{editingId ? 'Editar' : 'Nova'} Resposta</h2>
              <div className="space-y-4">
                <div><label className="block text-white mb-2">Nome</label><input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Triggers (separados por vírgula)</label><input type="text" value={formData.triggers} onChange={(e) => setFormData({...formData, triggers: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg" placeholder="oi, olá, hello"/></div>
                <div><label className="block text-white mb-2">Resposta</label><textarea value={formData.response} onChange={(e) => setFormData({...formData, response: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg h-24"/></div>
                <div><label className="block text-white mb-2">Tipo de Match</label><select value={formData.matchType} onChange={(e) => setFormData({...formData, matchType: e.target.value as any})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg">{['contains', 'exact', 'startsWith', 'endsWith', 'regex'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-white mb-2">Cooldown (segundos)</label><input type="number" value={formData.cooldown} onChange={(e) => setFormData({...formData, cooldown: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div className="flex gap-3">
                  <button onClick={saveResponse} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg">Salvar</button>
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
