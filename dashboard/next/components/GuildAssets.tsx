'use client';

import { useState, useEffect } from 'react';

interface WebhookConfig {
  channel_id: string;
  webhook_id: string;
  webhook_token: string;
  use_custom_avatar: boolean;
  custom_name?: string;
  enabled: boolean;
}

interface GuildAssetConfig {
  guild_id: string;
  custom_avatar_url?: string;
  custom_avatar_base64?: string;
  custom_banner_url?: string;
  custom_banner_base64?: string;
  webhook_configs: WebhookConfig[];
}

interface GuildAssetsProps {
  guildId: string;
}

export default function GuildAssets({ guildId }: GuildAssetsProps) {
  const [config, setConfig] = useState<GuildAssetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [guildId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guild/${guildId}/assets`);
      const data = await response.json();

      if (data.success) {
        setConfig(data.config);
        
        // Set previews
        if (data.config.custom_avatar_url) {
          setAvatarPreview(data.config.custom_avatar_url);
        } else if (data.config.custom_avatar_base64) {
          setAvatarPreview(data.config.custom_avatar_base64);
        }
        
        if (data.config.custom_banner_url) {
          setBannerPreview(data.config.custom_banner_url);
        } else if (data.config.custom_banner_base64) {
          setBannerPreview(data.config.custom_banner_base64);
        }
      } else {
        setError(data.error || 'Failed to load configuration');
      }
    } catch (err) {
      console.error('Failed to load config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Avatar must be less than 10MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Avatar must be an image');
      return;
    }

    setAvatarFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Banner must be less than 10MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Banner must be an image');
      return;
    }

    setBannerFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        const response = await fetch(`/api/guild/${guildId}/assets/avatar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Avatar uploaded successfully!');
          setConfig(data.config);
          setAvatarFile(null);
        } else {
          setError(data.error || 'Failed to upload avatar');
        }

        setSaving(false);
      };

      reader.readAsDataURL(avatarFile);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload avatar');
      setSaving(false);
    }
  };

  const uploadBanner = async () => {
    if (!bannerFile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        const response = await fetch(`/api/guild/${guildId}/assets/banner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Banner uploaded successfully!');
          setConfig(data.config);
          setBannerFile(null);
        } else {
          setError(data.error || 'Failed to upload banner');
        }

        setSaving(false);
      };

      reader.readAsDataURL(bannerFile);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload banner');
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (!confirm('Remove custom avatar?')) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/guild/${guildId}/assets/avatar`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Avatar removed');
        setConfig(data.config);
        setAvatarPreview(null);
        setAvatarFile(null);
      } else {
        setError(data.error || 'Failed to remove avatar');
      }
    } catch (err) {
      console.error('Remove failed:', err);
      setError('Failed to remove avatar');
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async () => {
    if (!confirm('Remove custom banner?')) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/guild/${guildId}/assets/banner`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Banner removed');
        setConfig(data.config);
        setBannerPreview(null);
        setBannerFile(null);
      } else {
        setError(data.error || 'Failed to remove banner');
      }
    } catch (err) {
      console.error('Remove failed:', err);
      setError('Failed to remove banner');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Guild Assets - Avatar & Banner</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Upload custom avatar and banner for your server. These assets can be used with webhooks to customize bot messages.
        </p>

        <div className="bg-blue-100 dark:bg-blue-900 border border-blue-400 text-blue-700 dark:text-blue-200 px-4 py-3 rounded mb-6">
          <p className="font-semibold">ℹ️ How Webhooks Work:</p>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>Custom avatars work via Discord webhooks (not the bot itself)</li>
            <li>Each channel needs its own webhook configured</li>
            <li>Maximum file size: 10MB</li>
            <li>Supported formats: PNG, JPG, GIF</li>
          </ul>
        </div>

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

        <div className="grid grid-cols-2 gap-6">
          {/* Avatar Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Custom Avatar</h3>
            
            {avatarPreview && (
              <div className="flex justify-center">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-gray-300 dark:border-gray-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Image (max 10MB)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={saving}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={uploadAvatar}
                disabled={!avatarFile || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Uploading...' : 'Upload Avatar'}
              </button>

              {avatarPreview && (
                <button
                  onClick={removeAvatar}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Banner Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Custom Banner</h3>
            
            {bannerPreview && (
              <div className="flex justify-center">
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-32 object-cover rounded-md border-4 border-gray-300 dark:border-gray-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Image (max 10MB)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                disabled={saving}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={uploadBanner}
                disabled={!bannerFile || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Uploading...' : 'Upload Banner'}
              </button>

              {bannerPreview && (
                <button
                  onClick={removeBanner}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
