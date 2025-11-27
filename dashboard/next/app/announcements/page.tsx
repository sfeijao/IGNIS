'use client';

import { useState } from 'react';
import { useGuildId } from '@/hooks/useGuildId';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface Announcement {
  _id: string;
  title: string;
  message: string;
  embed: {
    enabled: boolean;
    color: string;
    thumbnail?: string;
    image?: string;
    footer?: string;
  };
  channelId: string;
  scheduledFor: Date;
  repeat: {
    enabled: boolean;
    interval?: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
  };
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: Date;
  createdAt: Date;
}

export default function AnnouncementsPage() {
  const guildId = useGuildId();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    channelId: '',
    scheduledFor: '',
    embedEnabled: true,
    embedColor: '#5865F2',
    embedImage: '',
    repeatEnabled: false,
    repeatInterval: 'daily' as 'daily' | 'weekly' | 'monthly'
  });

  const { data, loading, error, refetch } = useSafeAPI<Announcement[]>(
    async () => {
      const res = await safeFetch<{ announcements: Announcement[] }>(`/api/guild/${guildId}/announcements`);
      return res.announcements || [];
    },
    [guildId],
    { skip: !guildId }
  );

  const announcements = data || [];

  const createAnnouncement = async () => {
    try {
      const data = {
        title: formData.title,
        message: formData.message,
        channelId: formData.channelId,
        scheduledFor: formData.scheduledFor,
        embed: {
          enabled: formData.embedEnabled,
          color: formData.embedColor,
          image: formData.embedImage || null
        },
        repeat: {
          enabled: formData.repeatEnabled,
          interval: formData.repeatEnabled ? formData.repeatInterval : null
        }
      };

      const res = await fetch(`/api/guild/${guildId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({
          title: '', message: '', channelId: '', scheduledFor: '',
          embedEnabled: true, embedColor: '#5865F2', embedImage: '',
          repeatEnabled: false, repeatInterval: 'daily'
        });
        refetch();
        alert('✅ Anúncio agendado!');
      } else {
        alert('❌ Erro ao agendar anúncio');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Deletar este anúncio?')) return;
    try {
      await fetch(`/api/guild/${guildId}/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      refetch();
      alert('✅ Anúncio deletado!');
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Erro ao deletar anúncio');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-600',
      sent: 'bg-green-600',
      failed: 'bg-red-600',
      cancelled: 'bg-gray-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar anúncios" />;
  }

  if (loading) {
    return <LoadingState message="Carregando anúncios..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">📢 Anúncios Agendados</h1>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700">
            ➕ Agendar Anúncio
          </button>
        </div>

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400">Nenhum anúncio agendado</p>
            </div>
          ) : (
            announcements.map((ann) => (
              <div key={ann._id} className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-xl mb-2">{ann.title}</h3>
                    <p className="text-gray-300 mb-3">{ann.message}</p>
                    <div className="flex gap-4 text-sm text-gray-400 mb-2">
                      <span>📅 {new Date(ann.scheduledFor).toLocaleString('pt-BR')}</span>
                      {ann.repeat.enabled && <span>🔄 Repetir {ann.repeat.interval}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`px-3 py-1 rounded-full text-white font-semibold ${getStatusColor(ann.status)}`}>
                      {ann.status.toUpperCase()}
                    </span>
                    {ann.status === 'pending' && (
                      <button onClick={() => deleteAnnouncement(ann._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
                {ann.sentAt && (
                  <p className="text-green-400 text-sm">✅ Enviado em {new Date(ann.sentAt).toLocaleString('pt-BR')}</p>
                )}
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">📢 Agendar Anúncio</h2>
              <div className="space-y-4">
                <div><label className="block text-white mb-2">Título</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Mensagem</label><textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg h-32"/></div>
                <div><label className="block text-white mb-2">Canal ID</label><input type="text" value={formData.channelId} onChange={(e) => setFormData({...formData, channelId: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg" placeholder="123456789012345678"/></div>
                <div><label className="block text-white mb-2">Data/Hora</label><input type="datetime-local" value={formData.scheduledFor} onChange={(e) => setFormData({...formData, scheduledFor: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>

                <div className="border-t border-gray-700 pt-4">
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" checked={formData.embedEnabled} onChange={(e) => setFormData({...formData, embedEnabled: e.target.checked})} className="w-5 h-5"/>
                    <span className="text-white">Usar Embed</span>
                  </label>
                  {formData.embedEnabled && (
                    <div className="space-y-3 ml-8">
                      <div><label className="block text-white mb-2">Cor</label><input type="color" value={formData.embedColor} onChange={(e) => setFormData({...formData, embedColor: e.target.value})} className="w-20 h-10 bg-gray-700 rounded-lg"/></div>
                      <div><label className="block text-white mb-2">URL Imagem</label><input type="text" value={formData.embedImage} onChange={(e) => setFormData({...formData, embedImage: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" checked={formData.repeatEnabled} onChange={(e) => setFormData({...formData, repeatEnabled: e.target.checked})} className="w-5 h-5"/>
                    <span className="text-white">Repetir</span>
                  </label>
                  {formData.repeatEnabled && (
                    <select value={formData.repeatInterval} onChange={(e) => setFormData({...formData, repeatInterval: e.target.value as any})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg ml-8">
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Semanalmente</option>
                      <option value="monthly">Mensalmente</option>
                    </select>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={createAnnouncement} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg">Agendar</button>
                  <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-lg">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
