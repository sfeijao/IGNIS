import React, { useState, useEffect } from 'react';

interface StatsConfig {
  guild_id: string;
  enabled: boolean;
  category_id?: string;
  category_name: string;
  update_interval_minutes: number;
  metrics: {
    total_members: boolean;
    human_members: boolean;
    bot_members: boolean;
    online_members: boolean;
    boosters: boolean;
    total_channels: boolean;
    total_roles: boolean;
    active_tickets: boolean;
  };
  channels: {
    total_members?: string;
    human_members?: string;
    bot_members?: string;
    online_members?: string;
    boosters?: string;
    total_channels?: string;
    total_roles?: string;
    active_tickets?: string;
  };
  custom_names: Record<string, string>;
  last_update_at?: string;
}

interface Metrics {
  total_members: number;
  human_members: number;
  bot_members: number;
  online_members: number;
  boosters: number;
  total_channels: number;
  total_roles: number;
  active_tickets: number;
}

interface Category {
  id: string;
  name: string;
}

interface ServerStatsProps {
  guildId: string;
}

const METRIC_LABELS: Record<keyof Metrics, string> = {
  total_members: '👥 Total Members',
  human_members: '👤 Human Members',
  bot_members: '🤖 Bot Members',
  online_members: '🟢 Online Members',
  boosters: '💎 Server Boosters',
  total_channels: '📺 Total Channels',
  total_roles: '🎭 Total Roles',
  active_tickets: '🎫 Active Tickets'
};

export default function ServerStats({ guildId }: ServerStatsProps) {
  const [config, setConfig] = useState<StatsConfig | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedMetrics, setSelectedMetrics] = useState<Set<keyof Metrics>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [updateInterval, setUpdateInterval] = useState<number>(10);

  useEffect(() => {
    loadData();
  }, [guildId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load config
      const configRes = await fetch(`/api/guild/${guildId}/stats/config`);
      const configData = await configRes.json();

      if (configData.success) {
        setConfig(configData.config);
        
        if (configData.config) {
          // Set selected metrics from existing config
          const selected = new Set<keyof Metrics>();
          Object.entries(configData.config.metrics).forEach(([key, value]) => {
            if (value === true) {
              selected.add(key as keyof Metrics);
            }
          });
          setSelectedMetrics(selected);
          setSelectedCategory(configData.config.category_id || '');
          setUpdateInterval(configData.config.update_interval_minutes || 10);
        } else if (configData.defaults) {
          // Use defaults
          const selected = new Set<keyof Metrics>();
          Object.entries(configData.defaults.metrics).forEach(([key, value]) => {
            if (value === true) {
              selected.add(key as keyof Metrics);
            }
          });
          setSelectedMetrics(selected);
          setUpdateInterval(configData.defaults.update_interval_minutes || 10);
        }
      }

      // Load current metrics (preview)
      const metricsRes = await fetch(`/api/guild/${guildId}/stats/metrics`);
      const metricsData = await metricsRes.json();
      
      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }

      // Load categories
      const categoriesRes = await fetch(`/api/guild/${guildId}/categories`);
      const categoriesData = await categoriesRes.json();
      
      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }

    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load server stats configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = (metric: keyof Metrics) => {
    const newSelected = new Set(selectedMetrics);
    if (newSelected.has(metric)) {
      newSelected.delete(metric);
    } else {
      newSelected.add(metric);
    }
    setSelectedMetrics(newSelected);
  };

  const handleSetup = async () => {
    if (selectedMetrics.size === 0) {
      setError('Please select at least one metric');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/guild/${guildId}/stats/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: Array.from(selectedMetrics),
          categoryId: selectedCategory || undefined,
          updateInterval
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Server stats setup successfully!');
        await loadData(); // Reload config
      } else {
        setError(data.error || 'Failed to setup server stats');
      }
    } catch (err) {
      console.error('Setup failed:', err);
      setError('Failed to setup server stats');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/guild/${guildId}/stats/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !config.enabled
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Server stats ${!config.enabled ? 'enabled' : 'disabled'}`);
        setConfig(data.config);
      } else {
        setError(data.error || 'Failed to update configuration');
      }
    } catch (err) {
      console.error('Toggle failed:', err);
      setError('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (deleteChannels: boolean) => {
    if (!confirm(deleteChannels 
      ? 'Are you sure you want to disable stats and DELETE all stat channels?' 
      : 'Are you sure you want to disable stats? (channels will remain but stop updating)'
    )) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/guild/${guildId}/stats?deleteChannels=${deleteChannels}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Server stats disabled');
        await loadData();
      } else {
        setError(data.error || 'Failed to disable server stats');
      }
    } catch (err) {
      console.error('Disable failed:', err);
      setError('Failed to disable server stats');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Server Stats - Dynamic Channels</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Automatically create and update voice channels with live server statistics.
          Channels update every {updateInterval} minutes.
        </p>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {config && config.enabled && (
          <div className="bg-blue-100 dark:bg-blue-900 border border-blue-400 text-blue-700 dark:text-blue-200 px-4 py-3 rounded mb-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">✅ Server stats are ACTIVE</span>
              <button
                onClick={handleToggleEnabled}
                disabled={saving}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Pause Updates'}
              </button>
            </div>
            {config.last_update_at && (
              <div className="mt-2 text-sm">
                Last updated: {new Date(config.last_update_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {config && !config.enabled && (
          <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-200 px-4 py-3 rounded mb-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">⏸️ Server stats are PAUSED</span>
              <button
                onClick={handleToggleEnabled}
                disabled={saving}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Resume Updates'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Category (where to create channels)
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              disabled={saving}
            >
              <option value="">Create new category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to create a new "📊 SERVER STATS" category
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Update Interval (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={updateInterval}
              onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to update channel names (5-60 minutes)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Select Metrics to Track
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has(key as keyof Metrics)}
                    onChange={() => toggleMetric(key as keyof Metrics)}
                    disabled={saving}
                    className="w-4 h-4"
                  />
                  <span className="flex-1">{label}</span>
                  {metrics && (
                    <span className="font-mono text-sm text-gray-500">
                      {metrics[key as keyof Metrics]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {metrics && selectedMetrics.size > 0 && (
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Preview:</h3>
              <div className="space-y-1 text-sm font-mono">
                {Array.from(selectedMetrics).map((metric) => (
                  <div key={metric}>
                    {METRIC_LABELS[metric].split(' ')[0]} {METRIC_LABELS[metric].split(' ').slice(1).join(' ')}: {metrics[metric]}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSetup}
              disabled={saving || selectedMetrics.size === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Setting up...' : config ? 'Update Configuration' : 'Setup Server Stats'}
            </button>

            {config && (
              <button
                onClick={() => handleDisable(false)}
                disabled={saving}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                Disable
              </button>
            )}

            {config && (
              <button
                onClick={() => handleDisable(true)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete All
              </button>
            )}
          </div>
        </div>

        {config && Object.keys(config.channels).some((k) => config.channels[k as keyof typeof config.channels]) && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold mb-3">Created Channels:</h3>
            <div className="space-y-2">
              {Object.entries(config.channels).map(([metric, channelId]) => {
                if (!channelId) return null;
                return (
                  <div key={metric} className="flex items-center justify-between text-sm">
                    <span>{METRIC_LABELS[metric as keyof Metrics]}</span>
                    <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      {channelId}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
