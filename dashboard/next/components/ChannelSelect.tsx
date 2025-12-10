'use client';

import { useState, useEffect } from 'react';

interface Channel {
  id: string;
  name: string;
  type: number;
  typeName: string;
  parentId?: string | null;
  parentName?: string | null;
}

interface ChannelSelectProps {
  guildId: string;
  value: string;
  onChange: (channelId: string, channel?: Channel) => void;
  label?: string;
  placeholder?: string;
  types?: number[]; // Filter by channel types
  includeCategories?: boolean;
  required?: boolean;
  className?: string;
}

export default function ChannelSelect({
  guildId,
  value,
  onChange,
  label = 'Canal',
  placeholder = 'Selecionar canal...',
  types,
  includeCategories = false,
  required = false,
  className = ''
}: ChannelSelectProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManualInput, setCanManualInput] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedChannel, setVerifiedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    loadChannels();
  }, [guildId]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (types && types.length > 0) {
        params.set('type', types.join(','));
      }
      if (includeCategories) {
        params.set('includeCategories', 'true');
      }

      const res = await fetch(`/api/guild/${guildId}/channels?${params}`);
      const data = await res.json();

      if (data.success) {
        setChannels(data.channels || []);
        setCanManualInput(data.canManualInput || false);

        if (data.channels.length === 0 && data.canManualInput) {
          setShowManualInput(true);
        }
      } else {
        setError(data.error || 'Failed to load channels');
        setCanManualInput(data.canManualInput || false);

        if (data.instructions) {
          setError(`${data.error}. ${data.instructions}`);
        }

        if (data.canManualInput) {
          setShowManualInput(true);
        }
      }
    } catch (err) {
      setError('Failed to load channels. You can enter a channel ID manually.');
      setCanManualInput(true);
      setShowManualInput(true);
    } finally {
      setLoading(false);
    }
  };

  const verifyChannel = async () => {
    if (!manualId.trim()) return;

    try {
      setVerifying(true);
      setError(null);

      const res = await fetch(`/api/guild/${guildId}/channels/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: manualId.trim() })
      });

      const data = await res.json();

      if (data.success && data.channel) {
        setVerifiedChannel(data.channel);
        onChange(data.channel.id, data.channel);
        setError(null);
      } else {
        setError(data.error || 'Channel verification failed');
        setVerifiedChannel(null);
      }
    } catch (err) {
      setError('Failed to verify channel');
      setVerifiedChannel(null);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-xl">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
          <span className="text-sm text-gray-400">A carregar canais...</span>
        </div>
      ) : error && !showManualInput ? (
        <div className="space-y-2">
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          {canManualInput && (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              📝 Inserir ID do canal manualmente
            </button>
          )}
        </div>
      ) : showManualInput ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Cole o ID do canal aqui (17-19 dígitos)"
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              pattern="^\d{17,19}$"
            />
            <button
              type="button"
              onClick={verifyChannel}
              disabled={verifying || !manualId.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium"
            >
              {verifying ? '⏳' : '✓'} Verificar
            </button>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {verifiedChannel && (
            <div className="px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Canal verificado!</p>
                  <p className="text-xs text-gray-400">
                    #{verifiedChannel.name} ({verifiedChannel.typeName})
                  </p>
                </div>
              </div>
            </div>
          )}

          {channels.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowManualInput(false);
                setManualId('');
                setVerifiedChannel(null);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              ← Voltar à lista de canais
            </button>
          )}

          <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-xs text-blue-300 mb-2">💡 Como obter o ID de um canal:</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Ative o Modo Desenvolvedor no Discord (Configurações → Avançado)</li>
              <li>Clique com botão direito no canal</li>
              <li>Selecione "Copiar ID do Canal"</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            value={value}
            onChange={(e) => {
              const selectedChannel = channels.find(c => c.id === e.target.value);
              onChange(e.target.value, selectedChannel);
            }}
            required={required}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">{placeholder}</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.parentName ? `${channel.parentName} / ` : ''}
                #{channel.name} ({channel.typeName})
              </option>
            ))}
          </select>

          {canManualInput && (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              📝 Ou inserir ID do canal manualmente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
