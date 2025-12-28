'use client';

import { useState, useEffect } from 'react';
import { useGuildIdWithLoading } from '@/lib/guild';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface Suggestion {
  _id: string;
  number?: number;
  userId: string;
  username?: string;
  userAvatar?: string;
  messageId: string;
  channelId: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  votes: {
    upvotes: string[];
    downvotes: string[];
  };
  embed?: {
    color?: string;
    image?: string;
    thumbnail?: string;
  };
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
}

interface SuggestionsConfig {
  enabled: boolean;
  channelId?: string;
  channelName?: string;
}

export default function SuggestionsPage() {
  const { guildId, loading: guildLoading } = useGuildIdWithLoading();
  const [filter, setFilter] = useState<string>('all');
  const [config, setConfig] = useState<SuggestionsConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [channels, setChannels] = useState<{id: string, name: string, type: number}[]>([]);
  const [configChannel, setConfigChannel] = useState('');

  const url = filter === 'all'
    ? `/api/guild/${guildId}/suggestions`
    : `/api/guild/${guildId}/suggestions?status=${filter}`;

  const { data, loading, error, refetch } = useSafeAPI<{ success: boolean; suggestions: Suggestion[], config?: SuggestionsConfig }>(
    () => safeFetch(url),
    [guildId, filter],
    { skip: !guildId }
  );

  const suggestions = data?.suggestions || [];

  // Fetch config and channels
  useEffect(() => {
    if (!guildId) return;
    
    // Get suggestions config
    safeFetch<{ config: SuggestionsConfig }>(`/api/guild/${guildId}/suggestions/config`)
      .then(r => setConfig(r.config))
      .catch(() => setConfig({ enabled: false }));
    
    // Get channels for config
    safeFetch<{ channels: {id: string, name: string, type: number}[] }>(`/api/guild/${guildId}/channels`)
      .then(r => setChannels((r.channels || []).filter(c => c.type === 0)))
      .catch(() => {});
  }, [guildId]);

  const updateStatus = async (messageId: string, status: string, reviewNote?: string) => {
    try {
      await safeFetch(`/api/guild/${guildId}/suggestions/${messageId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNote })
      });

      refetch();
      alert('✅ Status atualizado!');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao atualizar'}`);
    }
  };

  const handleStatusChange = (messageId: string, status: string) => {
    const note = prompt('Nota (opcional):');
    updateStatus(messageId, status, note || undefined);
  };

  const saveConfig = async () => {
    try {
      await safeFetch(`/api/guild/${guildId}/suggestions/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: configChannel, enabled: true })
      });
      setConfig({ enabled: true, channelId: configChannel });
      setShowConfigModal(false);
      alert('✅ Configuração salva! Membros podem usar /sugestao no Discord.');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao salvar'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: '⏳', label: 'Pendente' },
      approved: { bg: 'bg-green-500/10', text: 'text-green-400', icon: '✅', label: 'Aprovada' },
      rejected: { bg: 'bg-red-500/10', text: 'text-red-400', icon: '❌', label: 'Rejeitada' },
      implemented: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: '🎉', label: 'Implementada' }
    };
    const b = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${b.bg} ${b.text}`}>
        <span>{b.icon}</span> {b.label}
      </span>
    );
  };

  const getVoteScore = (votes: Suggestion['votes']) => {
    return votes.upvotes.length - votes.downvotes.length;
  };

  if (guildLoading) {
    return <LoadingState message="Carregando..." />;
  }

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar sugestões" />;
  }

  if (loading) {
    return <LoadingState message="Carregando sugestões..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              💡 Sistema de Sugestões
            </h1>
            <p className="text-gray-400 mt-2">Gerencie as sugestões enviadas pelos membros no Discord</p>
          </div>
          <button 
            onClick={() => { setConfigChannel(config?.channelId || ''); setShowConfigModal(true); }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            ⚙️ Configurar
          </button>
        </div>

        {/* Config Status */}
        {config && (
          <div className={`mb-6 p-4 rounded-lg border ${config.enabled ? 'bg-green-900/20 border-green-500/30' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{config.enabled ? '✅' : '⚠️'}</span>
                <div>
                  <p className="text-white font-medium">
                    {config.enabled ? 'Sistema Ativo' : 'Sistema Não Configurado'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {config.enabled && config.channelId 
                      ? `Canal: #${config.channelName || config.channelId}`
                      : 'Configure um canal para os membros enviarem sugestões com /sugestao'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 mb-6 border border-purple-500/30">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todas', icon: '📋' },
              { key: 'pending', label: 'Pendentes', icon: '⏳' },
              { key: 'approved', label: 'Aprovadas', icon: '✅' },
              { key: 'rejected', label: 'Rejeitadas', icon: '❌' },
              { key: 'implemented', label: 'Implementadas', icon: '🎉' }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                  filter === f.key
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                <span>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-sm">Total</p>
            <p className="text-white text-3xl font-bold">{suggestions.length}</p>
          </div>
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-500/30">
            <p className="text-yellow-400 text-sm">Pendentes</p>
            <p className="text-white text-3xl font-bold">
              {suggestions.filter(s => s.status === 'pending').length}
            </p>
          </div>
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
            <p className="text-green-400 text-sm">Aprovadas</p>
            <p className="text-white text-3xl font-bold">
              {suggestions.filter(s => s.status === 'approved').length}
            </p>
          </div>
          <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
            <p className="text-red-400 text-sm">Rejeitadas</p>
            <p className="text-white text-3xl font-bold">
              {suggestions.filter(s => s.status === 'rejected').length}
            </p>
          </div>
          <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-500/30">
            <p className="text-blue-400 text-sm">Implementadas</p>
            <p className="text-white text-3xl font-bold">
              {suggestions.filter(s => s.status === 'implemented').length}
            </p>
          </div>
        </div>

        {/* Suggestions List */}
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 text-center border border-purple-500/30">
              <span className="text-6xl mb-4 block">💡</span>
              <h3 className="text-xl font-bold text-white mb-2">Nenhuma sugestão ainda</h3>
              <p className="text-gray-400 mb-4">
                Configure o sistema para que os membros possam enviar sugestões usando <code className="bg-gray-700 px-2 py-1 rounded">/sugestao</code>
              </p>
              <button 
                onClick={() => setShowConfigModal(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Configurar Sistema
              </button>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion._id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-purple-500/30 hover:border-purple-500/50 transition-all"
              >
                {/* Discord-style embed header */}
                <div 
                  className="h-1"
                  style={{ backgroundColor: suggestion.embed?.color || '#5865F2' }}
                />
                
                <div className="p-6">
                  <div className="flex gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {suggestion.userAvatar ? (
                        <img 
                          src={suggestion.userAvatar} 
                          alt="" 
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl">
                          💡
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-purple-400 font-medium">
                          {suggestion.username || `User ${suggestion.userId.slice(-4)}`}
                        </span>
                        <span className="text-gray-500 text-sm">
                          #{suggestion.number || index + 1}
                        </span>
                        {getStatusBadge(suggestion.status)}
                      </div>
                      
                      <h3 className="text-white font-bold text-lg mb-2">{suggestion.title}</h3>
                      <p className="text-gray-300 whitespace-pre-wrap">{suggestion.description}</p>
                      
                      {/* Embed Image Preview */}
                      {suggestion.embed?.image && (
                        <img 
                          src={suggestion.embed.image} 
                          alt="" 
                          className="mt-4 rounded-lg max-h-64 object-cover"
                        />
                      )}
                      
                      {/* Review Note */}
                      {suggestion.reviewNote && (
                        <div className="mt-4 p-3 bg-purple-900/30 rounded-lg border-l-4 border-purple-500">
                          <p className="text-purple-200 text-sm">
                            <strong>📝 Resposta do Staff:</strong> {suggestion.reviewNote}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Thumbnail */}
                    {suggestion.embed?.thumbnail && (
                      <img 
                        src={suggestion.embed.thumbnail} 
                        alt="" 
                        className="w-20 h-20 rounded object-cover flex-shrink-0"
                      />
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-wrap items-center justify-between gap-4">
                    {/* Votes */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3 bg-gray-900/50 rounded-full px-4 py-2">
                        <span className="flex items-center gap-1 text-green-400">
                          <span className="text-lg">👍</span>
                          <span className="font-bold">{suggestion.votes.upvotes.length}</span>
                        </span>
                        <div className="w-px h-4 bg-gray-600" />
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="text-lg">👎</span>
                          <span className="font-bold">{suggestion.votes.downvotes.length}</span>
                        </span>
                        <div className="w-px h-4 bg-gray-600" />
                        <span className={`font-bold ${getVoteScore(suggestion.votes) > 0 ? 'text-green-400' : getVoteScore(suggestion.votes) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {getVoteScore(suggestion.votes) > 0 ? '+' : ''}{getVoteScore(suggestion.votes)}
                        </span>
                      </div>
                      <span className="text-gray-500 text-sm">
                        📅 {new Date(suggestion.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      {suggestion.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(suggestion.messageId, 'approved')}
                            className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 font-medium text-sm flex items-center gap-2"
                          >
                            ✅ Aprovar
                          </button>
                          <button
                            onClick={() => handleStatusChange(suggestion.messageId, 'rejected')}
                            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 font-medium text-sm flex items-center gap-2"
                          >
                            ❌ Rejeitar
                          </button>
                        </>
                      )}
                      {suggestion.status === 'approved' && (
                        <button
                          onClick={() => handleStatusChange(suggestion.messageId, 'implemented')}
                          className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 font-medium text-sm flex items-center gap-2"
                        >
                          🎉 Marcar Implementada
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Config Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-purple-500/30">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                ⚙️ Configurar Sugestões
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white mb-2 font-medium">Canal de Sugestões</label>
                  <select
                    value={configChannel}
                    onChange={(e) => setConfigChannel(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Selecione um canal</option>
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-sm mt-2">
                    As sugestões enviadas com <code className="bg-gray-700 px-1 rounded">/sugestao</code> serão postadas neste canal
                  </p>
                </div>
                
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Como funciona:</h3>
                  <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                    <li>Membros usam <code className="bg-gray-700 px-1 rounded">/sugestao</code> no Discord</li>
                    <li>A sugestão é postada no canal configurado</li>
                    <li>Membros podem votar com 👍 e 👎</li>
                    <li>Você gerencia tudo aqui no dashboard</li>
                  </ol>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveConfig}
                  disabled={!configChannel}
                  className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Salvar
                </button>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
