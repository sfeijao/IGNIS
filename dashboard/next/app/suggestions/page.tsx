'use client';

import { useState, useEffect } from 'react';
import { useGuildId } from '@/hooks/useGuildId';

interface Suggestion {
  _id: string;
  userId: string;
  messageId: string;
  channelId: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  votes: {
    upvotes: string[];
    downvotes: string[];
  };
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
}

export default function SuggestionsPage() {
  const guildId = useGuildId();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (guildId) {
      fetchSuggestions();
    }
  }, [guildId, filter]);

  const fetchSuggestions = async () => {
    try {
      const url = filter === 'all'
        ? `/api/guild/${guildId}/suggestions`
        : `/api/guild/${guildId}/suggestions?status=${filter}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (messageId: string, status: string, reviewNote?: string) => {
    try {
      const res = await fetch(`/api/guild/${guildId}/suggestions/${messageId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reviewNote })
      });

      if (res.ok) {
        fetchSuggestions();
        alert('✅ Status atualizado!');
      }
    } catch (error) {
      console.error('Error updating suggestion:', error);
    }
  };

  const handleStatusChange = (messageId: string, status: string) => {
    const note = prompt('Nota (opcional):');
    updateStatus(messageId, status, note || undefined);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-600',
      approved: 'bg-green-600',
      rejected: 'bg-red-600',
      implemented: 'bg-blue-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  const getStatusEmoji = (status: string) => {
    const emojis: Record<string, string> = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      implemented: '🎉'
    };
    return emojis[status] || '⚪';
  };

  const filteredSuggestions = suggestions;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          💡 Sistema de Sugestões
        </h1>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-purple-500/30">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected', 'implemented'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-500/30">
            <p className="text-yellow-400 text-sm">Pendentes</p>
            <p className="text-white text-2xl font-bold">
              {suggestions.filter(s => s.status === 'pending').length}
            </p>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4 border border-green-500/30">
            <p className="text-green-400 text-sm">Aprovadas</p>
            <p className="text-white text-2xl font-bold">
              {suggestions.filter(s => s.status === 'approved').length}
            </p>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4 border border-red-500/30">
            <p className="text-red-400 text-sm">Rejeitadas</p>
            <p className="text-white text-2xl font-bold">
              {suggestions.filter(s => s.status === 'rejected').length}
            </p>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
            <p className="text-blue-400 text-sm">Implementadas</p>
            <p className="text-white text-2xl font-bold">
              {suggestions.filter(s => s.status === 'implemented').length}
            </p>
          </div>
        </div>

        {/* Suggestions List */}
        <div className="space-y-4">
          {filteredSuggestions.length === 0 ? (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400 text-lg">Nenhuma sugestão encontrada</p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion) => (
              <div
                key={suggestion._id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getStatusEmoji(suggestion.status)}</span>
                      <h3 className="text-white font-bold text-xl">{suggestion.title}</h3>
                    </div>
                    <p className="text-gray-300 mb-3">{suggestion.description}</p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-white font-semibold ${getStatusColor(suggestion.status)}`}>
                    {suggestion.status.toUpperCase()}
                  </span>
                </div>

                {/* Votes */}
                <div className="flex gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-2xl">👍</span>
                    <span className="text-white font-bold text-lg">{suggestion.votes.upvotes.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-2xl">👎</span>
                    <span className="text-white font-bold text-lg">{suggestion.votes.downvotes.length}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-gray-400 text-sm">
                      Por: <span className="font-mono">{suggestion.userId}</span>
                    </span>
                  </div>
                </div>

                {suggestion.reviewNote && (
                  <div className="mb-4 p-3 bg-purple-900/30 rounded-lg border border-purple-500/30">
                    <p className="text-purple-200 text-sm">
                      <strong>Nota do Staff:</strong> {suggestion.reviewNote}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {suggestion.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStatusChange(suggestion.messageId, 'approved')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                    >
                      ✅ Aprovar
                    </button>
                    <button
                      onClick={() => handleStatusChange(suggestion.messageId, 'rejected')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                    >
                      ❌ Rejeitar
                    </button>
                  </div>
                )}

                {suggestion.status === 'approved' && (
                  <button
                    onClick={() => handleStatusChange(suggestion.messageId, 'implemented')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    🎉 Marcar como Implementada
                  </button>
                )}

                <p className="text-gray-400 text-sm mt-3">
                  📅 {new Date(suggestion.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
