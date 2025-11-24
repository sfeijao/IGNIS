'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface AntiRaidConfig {
  sensitivity: 'low' | 'medium' | 'high' | 'paranoid';
  enabled: boolean;
  thresholds: {
    joinsPerMinute: number;
    accountAgeDays: number;
    similarNamesCount: number;
  };
  actions: {
    enabled: boolean;
    kick: boolean;
    ban: boolean;
    quarantine: boolean;
    quarantineRoleId?: string;
  };
  whitelist: {
    userIds: string[];
    roleIds: string[];
  };
  alertWebhook?: string;
}

interface RaidEvent {
  _id: string;
  startedAt: Date;
  endedAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'false_alarm';
  suspiciousMembers: string[];
  actionsToken: number;
}

export default function AntiRaidPage() {
  const params = useParams();
  const guildId = params?.guildId as string;
  
  const [config, setConfig] = useState<AntiRaidConfig | null>(null);
  const [raids, setRaids] = useState<RaidEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    try {
      const [configRes, raidsRes] = await Promise.all([
        fetch(`/api/guild/${guildId}/antiraid/config`, { credentials: 'include' }),
        fetch(`/api/guild/${guildId}/antiraid/raids`, { credentials: 'include' })
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
      }

      if (raidsRes.ok) {
        const data = await raidsRes.json();
        setRaids(data.raids || []);
      }
    } catch (error) {
      console.error('Error fetching anti-raid data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/guild/${guildId}/antiraid/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      if (res.ok) {
        alert('✅ Configuração salva com sucesso!');
      } else {
        alert('❌ Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('❌ Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const resolveRaid = async (raidId: string, status: 'resolved' | 'false_alarm') => {
    try {
      const res = await fetch(`/api/guild/${guildId}/antiraid/raids/${raidId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error resolving raid:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!config) {
    return <div className="p-8 text-center">Erro ao carregar configuração</div>;
  }

  const sensitivityPresets = {
    low: { joinsPerMinute: 10, accountAgeDays: 3 },
    medium: { joinsPerMinute: 7, accountAgeDays: 7 },
    high: { joinsPerMinute: 5, accountAgeDays: 14 },
    paranoid: { joinsPerMinute: 3, accountAgeDays: 30 }
  };

  const applySensitivity = (level: AntiRaidConfig['sensitivity']) => {
    setConfig({
      ...config,
      sensitivity: level,
      thresholds: {
        ...config.thresholds,
        ...sensitivityPresets[level]
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          🛡️ Sistema Anti-Raid
        </h1>

        {/* Configuration Panel */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-4">⚙️ Configuração</h2>
          
          {/* Enable Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-6 h-6 rounded"
              />
              <span className="text-white text-lg">Sistema Ativado</span>
            </label>
          </div>

          {/* Sensitivity Presets */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Sensibilidade</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['low', 'medium', 'high', 'paranoid'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => applySensitivity(level)}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                    config.sensitivity === level
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-white mb-2">Entradas por Minuto</label>
              <input
                type="number"
                value={config.thresholds.joinsPerMinute}
                onChange={(e) => setConfig({
                  ...config,
                  thresholds: { ...config.thresholds, joinsPerMinute: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-white mb-2">Idade Mínima Conta (dias)</label>
              <input
                type="number"
                value={config.thresholds.accountAgeDays}
                onChange={(e) => setConfig({
                  ...config,
                  thresholds: { ...config.thresholds, accountAgeDays: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Ações Automáticas</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer text-white">
                <input
                  type="checkbox"
                  checked={config.actions.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    actions: { ...config.actions, enabled: e.target.checked }
                  })}
                  className="w-5 h-5"
                />
                Habilitar Ações Automáticas
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-white ml-8">
                <input
                  type="checkbox"
                  checked={config.actions.quarantine}
                  onChange={(e) => setConfig({
                    ...config,
                    actions: { ...config.actions, quarantine: e.target.checked }
                  })}
                  className="w-5 h-5"
                  disabled={!config.actions.enabled}
                />
                Quarentena
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-white ml-8">
                <input
                  type="checkbox"
                  checked={config.actions.kick}
                  onChange={(e) => setConfig({
                    ...config,
                    actions: { ...config.actions, kick: e.target.checked }
                  })}
                  className="w-5 h-5"
                  disabled={!config.actions.enabled}
                />
                Expulsar (Kick)
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-white ml-8">
                <input
                  type="checkbox"
                  checked={config.actions.ban}
                  onChange={(e) => setConfig({
                    ...config,
                    actions: { ...config.actions, ban: e.target.checked }
                  })}
                  className="w-5 h-5"
                  disabled={!config.actions.enabled}
                />
                Banir (Ban)
              </label>
            </div>
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando...' : '💾 Salvar Configuração'}
          </button>
        </div>

        {/* Recent Raids */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-4">🚨 Raids Recentes</h2>
          
          {raids.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum raid detectado</p>
          ) : (
            <div className="space-y-4">
              {raids.map((raid) => (
                <div
                  key={raid._id}
                  className={`p-4 rounded-lg border-2 ${
                    raid.status === 'active'
                      ? 'bg-red-900/30 border-red-500'
                      : raid.status === 'resolved'
                      ? 'bg-green-900/30 border-green-500'
                      : 'bg-yellow-900/30 border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        Raid {raid.severity.toUpperCase()}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        {new Date(raid.startedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      raid.status === 'active'
                        ? 'bg-red-600 text-white'
                        : raid.status === 'resolved'
                        ? 'bg-green-600 text-white'
                        : 'bg-yellow-600 text-white'
                    }`}>
                      {raid.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 mb-3">
                    👥 Membros Suspeitos: {raid.suspiciousMembers.length}
                  </p>
                  
                  {raid.status === 'active' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => resolveRaid(raid._id, 'resolved')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        ✅ Resolvido
                      </button>
                      <button
                        onClick={() => resolveRaid(raid._id, 'false_alarm')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        ⚠️ Falso Alarme
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
