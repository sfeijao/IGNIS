'use client';

import { useState } from 'react';
import { useGuildIdWithLoading } from '@/lib/guild';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface Warn {
  _id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  level: number;
  punishment: 'none' | 'mute' | 'kick' | 'tempban' | 'ban';
  active: boolean;
  createdAt: Date;
  expiresAt?: Date;
  revoked?: {
    by: string;
    at: Date;
    reason: string;
  };
}

export default function WarnsPage() {
  const { guildId, loading: guildLoading } = useGuildIdWithLoading();
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('active');
  const [selectedUser, setSelectedUser] = useState<string>('');

  // Add warn modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWarn, setNewWarn] = useState({
    userId: '',
    reason: '',
    level: 1
  });

  const { data: warns = [], loading, error, refetch } = useSafeAPI<Warn[]>(
    async () => {
      const url = selectedUser
        ? `/api/guild/${guildId}/warns?userId=${selectedUser}`
        : `/api/guild/${guildId}/warns`;
      const res = await safeFetch<{ warns: Warn[] }>(url);
      return res.warns || [];
    },
    [guildId, selectedUser],
    { skip: !guildId }
  );

  const addWarn = async () => {
    try {
      await safeFetch(`/api/guild/${guildId}/warns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarn)
      });
      setShowAddModal(false);
      setNewWarn({ userId: '', reason: '', level: 1 });
      refetch();
      alert('✅ Aviso adicionado com sucesso!');
    } catch (error) {
      console.error('Error adding warn:', error);
      alert('❌ Erro ao adicionar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const revokeWarn = async (warnId: string) => {
    const reason = prompt('Motivo da revogação:');
    if (!reason) return;

    try {
      await safeFetch(`/api/guild/${guildId}/warns/${warnId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      refetch();
      alert('✅ Aviso revogado!');
    } catch (error) {
      console.error('Error revoking warn:', error);
      alert('❌ Erro ao revogar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const filteredWarns = (warns || []).filter(w => {
    if (filter === 'active') return w.active;
    if (filter === 'revoked') return !w.active;
    return true;
  });

  const getLevelColor = (level: number) => {
    if (level >= 5) return 'bg-red-600';
    if (level >= 4) return 'bg-orange-600';
    if (level >= 3) return 'bg-yellow-600';
    if (level >= 2) return 'bg-blue-600';
    return 'bg-gray-600';
  };

  const getPunishmentEmoji = (punishment: string) => {
    const emojis: Record<string, string> = {
      none: '⚪',
      mute: '🔇',
      kick: '👢',
      tempban: '⏰',
      ban: '🔨'
    };
    return emojis[punishment] || '⚪';
  };

  if (guildLoading) {
    return <LoadingState message="Carregando..." />;
  }

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar avisos" />;
  }

  if (loading) {
    return <LoadingState message="Carregando avisos..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            ⚠️ Sistema de Avisos
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700"
          >
            ➕ Adicionar Aviso
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-purple-500/30">
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              {(['all', 'active', 'revoked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Revogados'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Filtrar por User ID..."
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg min-w-[200px]"
            />
          </div>
        </div>

        {/* Warns List */}
        <div className="space-y-4">
          {filteredWarns.length === 0 ? (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400 text-lg">Nenhum aviso encontrado</p>
            </div>
          ) : (
            filteredWarns.map((warn) => (
              <div
                key={warn._id}
                className={`bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border ${
                  warn.active ? 'border-red-500/50' : 'border-gray-500/30'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-white font-bold ${getLevelColor(warn.level)}`}>
                      Nível {warn.level}
                    </span>
                    <span className="text-2xl">{getPunishmentEmoji(warn.punishment)}</span>
                    <span className="text-white font-semibold">{warn.punishment.toUpperCase()}</span>
                  </div>

                  {warn.active ? (
                    <button
                      onClick={() => revokeWarn(warn._id)}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
                    >
                      🗑️ Revogar
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold">
                      Revogado
                    </span>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-gray-400 text-sm">Usuário</p>
                    <p className="text-white font-mono">{warn.userId}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Moderador</p>
                    <p className="text-white font-mono">{warn.moderatorId}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-400 text-sm">Motivo</p>
                  <p className="text-white">{warn.reason}</p>
                </div>

                <div className="flex gap-6 text-sm text-gray-400">
                  <span>📅 {new Date(warn.createdAt).toLocaleString('pt-BR')}</span>
                  {warn.expiresAt && (
                    <span>⏰ Expira: {new Date(warn.expiresAt).toLocaleString('pt-BR')}</span>
                  )}
                </div>

                {warn.revoked && (
                  <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
                    <p className="text-yellow-200 text-sm">
                      <strong>Revogado por:</strong> {warn.revoked.by}
                    </p>
                    <p className="text-yellow-200 text-sm">
                      <strong>Motivo:</strong> {warn.revoked.reason}
                    </p>
                    <p className="text-yellow-200 text-sm">
                      <strong>Data:</strong> {new Date(warn.revoked.at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Warn Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-purple-500/30">
              <h2 className="text-2xl font-bold text-white mb-4">➕ Adicionar Aviso</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-white mb-2">User ID</label>
                  <input
                    type="text"
                    value={newWarn.userId}
                    onChange={(e) => setNewWarn({ ...newWarn, userId: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
                    placeholder="123456789012345678"
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Motivo</label>
                  <textarea
                    value={newWarn.reason}
                    onChange={(e) => setNewWarn({ ...newWarn, reason: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg h-24"
                    placeholder="Descreva o motivo do aviso..."
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Nível (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newWarn.level}
                    onChange={(e) => setNewWarn({ ...newWarn, level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
                  />
                  <p className="text-gray-400 text-sm mt-1">
                    Nível 1-2: Aviso | Nível 3: Kick | Nível 4: Tempban | Nível 5: Ban
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={addWarn}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
