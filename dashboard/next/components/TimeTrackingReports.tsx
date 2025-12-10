'use client';

import { useState, useEffect } from 'react';

interface Session {
  _id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  status: 'active' | 'paused' | 'ended';
  total_time_ms: number;
  active_time_ms: number;
  pauses: Array<{
    paused_at: string;
    resumed_at?: string;
    duration_ms?: number;
  }>;
}

interface UserStats {
  sessions: number;
  total_time_ms: number;
  active_time_ms: number;
}

interface GuildStats {
  total_sessions: number;
  total_time_ms: number;
  total_active_time_ms: number;
  avg_session_time_ms: number;
  user_stats: Record<string, UserStats>;
}

interface TimeTrackingReportsProps {
  guildId: string;
}

export default function TimeTrackingReports({ guildId }: TimeTrackingReportsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<GuildStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [guildId, startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // Load stats
      const statsRes = await fetch(`/api/guild/${guildId}/timetracking/report?${params}`);
      const statsData = await statsRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Load sessions
      const sessionsRes = await fetch(`/api/guild/${guildId}/timetracking/sessions?${params}`);
      const sessionsData = await sessionsRes.json();

      if (sessionsData.success) {
        setSessions(sessionsData.sessions);
      }

    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const h = hours;
    const m = minutes % 60;
    const s = seconds % 60;

    if (h > 0) {
      return `${h}h ${m}m`;
    } else if (m > 0) {
      return `${m}m ${s}s`;
    } else {
      return `${s}s`;
    }
  };

  const exportToCSV = () => {
    const headers = ['User ID', 'Status', 'Started At', 'Ended At', 'Total Time', 'Active Time', 'Pauses'];
    const rows = sessions.map(session => [
      session.user_id,
      session.status,
      new Date(session.started_at).toLocaleString(),
      session.ended_at ? new Date(session.ended_at).toLocaleString() : 'N/A',
      formatDuration(session.total_time_ms),
      formatDuration(session.active_time_ms),
      session.pauses.length.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracking-${guildId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const filteredSessions = selectedUser
    ? sessions.filter(s => s.user_id === selectedUser)
    : sessions;

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Time Tracking - Relatórios</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Visualiza e exporta sessões de bate-ponto
            </p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={sessions.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Exportar CSV
          </button>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Utilizador</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Todos</option>
              {stats && Object.keys(stats.user_stats).map(userId => (
                <option key={userId} value={userId}>{userId}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-300">Total Sessões</div>
              <div className="text-2xl font-bold">{stats.total_sessions}</div>
            </div>
            <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg">
              <div className="text-sm text-green-600 dark:text-green-300">Tempo Total</div>
              <div className="text-2xl font-bold">{formatDuration(stats.total_time_ms)}</div>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-lg">
              <div className="text-sm text-purple-600 dark:text-purple-300">Tempo Ativo</div>
              <div className="text-2xl font-bold">{formatDuration(stats.total_active_time_ms)}</div>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900 p-4 rounded-lg">
              <div className="text-sm text-orange-600 dark:text-orange-300">Média/Sessão</div>
              <div className="text-2xl font-bold">{formatDuration(stats.avg_session_time_ms)}</div>
            </div>
          </div>
        )}

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">User ID</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Início</th>
                <th className="px-4 py-2 text-left">Fim</th>
                <th className="px-4 py-2 text-right">Tempo Ativo</th>
                <th className="px-4 py-2 text-center">Pausas</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma sessão encontrada
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session._id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-mono text-xs">{session.user_id.slice(0, 8)}...</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        session.status === 'active' ? 'bg-green-100 text-green-800' :
                        session.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(session.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {session.ended_at ? new Date(session.ended_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatDuration(session.active_time_ms)}</td>
                    <td className="px-4 py-3 text-center">{session.pauses.length}x</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
