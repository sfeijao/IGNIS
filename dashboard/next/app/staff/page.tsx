'use client';

import { useState } from 'react';
import { useGuildId } from '@/hooks/useGuildId';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface StaffStats {
  staffId: string;
  total: number;
  byType: Record<string, number>;
}

interface StaffMember {
  staffId: string;
  total: number;
  byType: Record<string, number>;
}

interface RecentAction {
  _id: string;
  staffId: string;
  actionType: string;
  targetId: string;
  reason: string;
  timestamp: Date;
}

interface StaffData {
  leaderboard: StaffMember[];
  actions: RecentAction[];
}

export default function StaffMonitoringPage() {
  const guildId = useGuildId();
  const [days, setDays] = useState(30);

  const { data, loading, error, refetch } = useSafeAPI<StaffData>(
    async () => {
      const [leaderRes, actionsRes] = await Promise.all([
        safeFetch(`/api/guild/${guildId}/staff/leaderboard?days=${days}`),
        safeFetch(`/api/guild/${guildId}/staff/recent?limit=50`)
      ]);
      return {
        leaderboard: leaderRes.leaderboard || [],
        actions: actionsRes.actions || []
      };
    },
    [guildId, days],
    { skip: !guildId }
  );

  const leaderboard = data?.leaderboard || [];
  const recentActions = data?.actions || [];

  const actionEmojis: Record<string, string> = {
    warn: '⚠️',
    mute: '🔇',
    unmute: '🔊',
    kick: '👢',
    ban: '🔨',
    unban: '✅',
    timeout: '⏰',
    untimeout: '⏱️',
    ticket_close: '🎫',
    ticket_delete: '🗑️'
  };

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para monitorar staff" />;
  }

  if (loading) {
    return <LoadingState message="Carregando estatísticas de staff..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">👮 Monitoramento de Staff</h1>

        {/* Period Selector */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-purple-500/30">
          <label className="text-white mr-4">Período:</label>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="px-4 py-2 bg-gray-700 text-white rounded-lg">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-4">🏆 Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhuma ação registrada</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((staff, index) => (
                  <div key={staff.staffId} className="bg-gray-700/50 rounded-lg p-4 flex items-center gap-4">
                    <div className={`text-3xl ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-mono font-semibold">{staff.staffId}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {Object.entries(staff.byType).map(([type, count]) => (
                          <span key={type} className="text-xs px-2 py-1 bg-purple-600 text-white rounded">
                            {actionEmojis[type] || '📋'} {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-400">{staff.total}</p>
                      <p className="text-xs text-gray-400">ações</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Actions */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-4">📋 Ações Recentes</h2>
            {recentActions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhuma ação recente</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {recentActions.map((action) => (
                  <div key={action._id} className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{actionEmojis[action.actionType]}</span>
                      <span className="text-white font-semibold">{action.actionType.toUpperCase()}</span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      <span className="font-mono">{action.staffId}</span> → <span className="font-mono">{action.targetId}</span>
                    </p>
                    <p className="text-gray-400 text-sm">{action.reason}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(action.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
