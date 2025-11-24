'use client';

import { useState, useEffect } from 'react';
import { useGuildId } from '@/hooks/useGuildId';
import { useI18n } from '@/hooks/useI18n';
import api from '@/utils/api';

interface InviteStats {
  totalInvites: number;
  activeInvites: number;
  totalJoins: number;
  validJoins: number;
  fakeJoins: number;
  leftJoins: number;
  fakeRate: string;
}

interface Inviter {
  inviterId: string;
  totalJoins: number;
  validJoins: number;
  fakeJoins: number;
  leftJoins: number;
  inviteCount: number;
  fakeRate: string;
}

interface Member {
  userId: string;
  username: string;
  inviteCode: string;
  inviterId: string;
  joinedAt: string;
  leftAt: string | null;
  isFake: boolean;
  fakeReason: string | null;
  accountAgeAtJoin: number;
  timeInServer: number | null;
}

export default function InvitesPage() {
  const guildId = useGuildId();
  const { t } = useI18n();

  const [stats, setStats] = useState<InviteStats | null>(null);
  const [topInviters, setTopInviters] = useState<Inviter[]>([]);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'leaderboard' | 'recent'>('overview');

  useEffect(() => {
    if (guildId) {
      loadData();
    }
  }, [guildId]);

  const loadData = async () => {
    if (!guildId) return;

    setLoading(true);
    try {
      const [statsRes, topRes] = await Promise.all([
        api.get<{ stats: InviteStats }>(`/api/guild/${guildId}/invites/stats`),
        api.get<{ inviters: Inviter[] }>(`/api/guild/${guildId}/invites/top?limit=10`)
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data.stats);
      if (topRes.success && topRes.data) setTopInviters(topRes.data.inviters);
    } catch (error) {
      console.error('Error loading invite data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!guildId) return;

    setSyncing(true);
    try {
      const res = await api.post(`/api/guild/${guildId}/invites/sync`);
      if (res.success) {
        await loadData();
      }
    } catch (error) {
      console.error('Error syncing invites:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getFakeReasonEmoji = (reason: string | null) => {
    switch (reason) {
      case 'quick_leave': return '⚡';
      case 'new_account': return '🆕';
      case 'no_interaction': return '💤';
      case 'mass_join': return '📊';
      case 'combined': return '🚨';
      default: return '❓';
    }
  };

  const getFakeReasonText = (reason: string | null) => {
    switch (reason) {
      case 'quick_leave': return 'Quick Leave (< 1h)';
      case 'new_account': return 'New Account (< 7d)';
      case 'no_interaction': return 'No Interaction';
      case 'mass_join': return 'Mass Join Pattern';
      case 'combined': return 'Multiple Red Flags';
      default: return 'Unknown';
    }
  };

  if (!guildId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="bg-yellow-600/20 backdrop-blur-xl border border-yellow-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <span>Please select a server to view invite statistics</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🎯</span>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Invite Tracker
                </h1>
                <p className="text-gray-400 text-sm mt-1">Track invites and detect fake members</p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Syncing...
                </>
              ) : (
                <>
                  🔄 Sync Invites
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
                  📨
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalJoins}</div>
                  <div className="text-sm text-gray-400">Total Joins</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
                  ✅
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.validJoins}</div>
                  <div className="text-sm text-gray-400">Valid Members</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-lg flex items-center justify-center text-2xl">
                  🚨
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.fakeJoins}</div>
                  <div className="text-sm text-gray-400">Fake/Suspicious</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-600/20 to-amber-600/20 rounded-lg flex items-center justify-center text-2xl">
                  📊
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{stats.fakeRate}%</div>
                  <div className="text-sm text-gray-400">Fake Rate</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                selectedTab === 'overview'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setSelectedTab('leaderboard')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                selectedTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              🏆 Leaderboard
            </button>
            <button
              onClick={() => setSelectedTab('recent')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                selectedTab === 'recent'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              📅 Recent Joins
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-12">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">Loading invite data...</div>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {selectedTab === 'overview' && stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Invite Distribution */}
                <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">📈</span>
                    <h3 className="text-lg font-semibold text-white">Invite Distribution</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Valid Members</span>
                        <span className="text-green-400 font-medium">{stats.validJoins}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-green-600 to-emerald-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${stats.totalJoins > 0 ? (stats.validJoins / stats.totalJoins) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Fake/Suspicious</span>
                        <span className="text-red-400 font-medium">{stats.fakeJoins}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-red-600 to-orange-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${stats.totalJoins > 0 ? (stats.fakeJoins / stats.totalJoins) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Left Server</span>
                        <span className="text-yellow-400 font-medium">{stats.leftJoins}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-yellow-600 to-amber-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${stats.totalJoins > 0 ? (stats.leftJoins / stats.totalJoins) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">📋</span>
                    <h3 className="text-lg font-semibold text-white">Quick Stats</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400">Total Invites</span>
                      <span className="text-white font-semibold">{stats.totalInvites}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400">Active Invites</span>
                      <span className="text-green-400 font-semibold">{stats.activeInvites}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400">Retention Rate</span>
                      <span className="text-cyan-400 font-semibold">
                        {stats.totalJoins > 0 ? ((stats.validJoins / stats.totalJoins) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400">Average per Invite</span>
                      <span className="text-purple-400 font-semibold">
                        {stats.totalInvites > 0 ? (stats.totalJoins / stats.totalInvites).toFixed(1) : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard Tab */}
            {selectedTab === 'leaderboard' && (
              <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">🏆</span>
                  <h3 className="text-lg font-semibold text-white">Top Inviters</h3>
                </div>
                <div className="space-y-3">
                  {topInviters.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">👻</div>
                      <div className="text-gray-400">No invite data available yet</div>
                    </div>
                  ) : (
                    topInviters.map((inviter, index) => (
                      <div
                        key={inviter.inviterId}
                        className="bg-gray-900/50 border border-gray-700 hover:border-purple-600/50 rounded-xl p-4 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-500 to-amber-500 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">
                              User ID: {inviter.inviterId}
                            </div>
                            <div className="flex gap-4 text-xs text-gray-400 mt-1">
                              <span>✅ {inviter.validJoins} valid</span>
                              <span>🚨 {inviter.fakeJoins} fake</span>
                              <span>📊 {inviter.fakeRate}% fake rate</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-400">{inviter.totalJoins}</div>
                            <div className="text-xs text-gray-500">{inviter.inviteCount} invites</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Recent Joins Tab */}
            {selectedTab === 'recent' && (
              <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📅</span>
                  <h3 className="text-lg font-semibold text-white">Recent Joins</h3>
                </div>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🚧</div>
                  <div className="text-gray-400">Coming soon - Recent member joins timeline</div>
                  <div className="text-sm text-gray-500 mt-2">This feature will show the latest members who joined and their invite details</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
