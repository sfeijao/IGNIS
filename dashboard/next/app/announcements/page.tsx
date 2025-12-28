'use client';

import { useState, useEffect } from 'react';
import { useGuildIdWithLoading } from '@/lib/guild';
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
  channelName?: string;
  messageId?: string;
  scheduledFor?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: Date;
  createdAt: Date;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

export default function AnnouncementsPage() {
  const { guildId, loading: guildLoading } = useGuildIdWithLoading();
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [sendNow, setSendNow] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    channelId: '',
    scheduledFor: '',
    embedEnabled: true,
    embedColor: '#5865F2',
    embedThumbnail: '',
    embedImage: '',
    embedFooter: ''
  });

  // Fetch channels when guild is available
  useEffect(() => {
    if (!guildId) return;
    setLoadingChannels(true);
    safeFetch<{ channels: Channel[] }>(`/api/guild/${guildId}/channels`)
      .then(data => {
        // Filter only text channels (type 0)
        const textChannels = (data.channels || []).filter(c => c.type === 0);
        setChannels(textChannels);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoadingChannels(false));
  }, [guildId]);

  const { data, loading, error, refetch } = useSafeAPI<Announcement[]>(
    async () => {
      const res = await safeFetch<{ announcements: Announcement[] }>(`/api/guild/${guildId}/announcements`);
      return res.announcements || [];
    },
    [guildId],
    { skip: !guildId }
  );

  const announcements = data || [];

  const resetForm = () => {
    setFormData({
      title: '', message: '', channelId: '', scheduledFor: '',
      embedEnabled: true, embedColor: '#5865F2', embedThumbnail: '',
      embedImage: '', embedFooter: ''
    });
    setEditingAnnouncement(null);
    setSendNow(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setFormData({
      title: ann.title,
      message: ann.message,
      channelId: ann.channelId,
      scheduledFor: ann.scheduledFor ? new Date(ann.scheduledFor).toISOString().slice(0, 16) : '',
      embedEnabled: ann.embed?.enabled ?? true,
      embedColor: ann.embed?.color || '#5865F2',
      embedThumbnail: ann.embed?.thumbnail || '',
      embedImage: ann.embed?.image || '',
      embedFooter: ann.embed?.footer || ''
    });
    setSendNow(false);
    setShowModal(true);
  };

  const createOrUpdateAnnouncement = async () => {
    if (!formData.title.trim() || !formData.message.trim() || !formData.channelId) {
      alert('❌ Preencha título, mensagem e selecione um canal');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        channelId: formData.channelId,
        scheduledFor: sendNow ? null : formData.scheduledFor || null,
        sendNow: sendNow,
        embed: {
          enabled: formData.embedEnabled,
          color: formData.embedColor,
          thumbnail: formData.embedThumbnail || null,
          image: formData.embedImage || null,
          footer: formData.embedFooter || null
        }
      };

      if (editingAnnouncement) {
        // Update existing
        const res = await safeFetch<{ success: boolean }>(`/api/guild/${guildId}/announcements/${editingAnnouncement._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.success) {
          setShowModal(false);
          resetForm();
          refetch();
          alert('✅ Anúncio atualizado!');
        }
      } else {
        // Create new
        const res = await safeFetch<{ success: boolean }>(`/api/guild/${guildId}/announcements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.success) {
          setShowModal(false);
          resetForm();
          refetch();
          alert(sendNow ? '✅ Anúncio enviado!' : '✅ Anúncio agendado!');
        }
      }
    } catch (error) {
      alert(`❌ Erro: ${error instanceof Error ? error.message : 'Falha na operação'}`);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Deletar este anúncio?')) return;
    try {
      await safeFetch(`/api/guild/${guildId}/announcements/${id}`, { method: 'DELETE' });
      refetch();
      alert('✅ Anúncio deletado!');
    } catch (error) {
      alert(`❌ Erro: ${error instanceof Error ? error.message : 'Falha ao deletar'}`);
    }
  };

  const resendAnnouncement = async (ann: Announcement) => {
    try {
      const res = await safeFetch<{ success: boolean }>(`/api/guild/${guildId}/announcements/${ann._id}/resend`, {
        method: 'POST'
      });
      if (res.success) {
        refetch();
        alert('✅ Anúncio reenviado!');
      }
    } catch (error) {
      alert(`❌ Erro: ${error instanceof Error ? error.message : 'Falha ao reenviar'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: '⏰ Agendado' },
      sent: { bg: 'bg-green-600/20', text: 'text-green-400', label: '✅ Enviado' },
      failed: { bg: 'bg-red-600/20', text: 'text-red-400', label: '❌ Falhou' },
      cancelled: { bg: 'bg-gray-600/20', text: 'text-gray-400', label: '🚫 Cancelado' }
    };
    const b = badges[status] || badges.pending;
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? `#${channel.name}` : `#${channelId}`;
  };

  if (guildLoading) {
    return <LoadingState message="Carregando..." />;
  }

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
          <div>
            <h1 className="text-4xl font-bold text-white">📢 Anúncios</h1>
            <p className="text-gray-400 mt-2">Crie e gerencie anúncios para seu servidor</p>
          </div>
          <button onClick={openCreateModal} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2">
            <span className="text-xl">➕</span> Novo Anúncio
          </button>
        </div>

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-purple-500/30">
              <span className="text-6xl mb-4 block">📢</span>
              <h3 className="text-xl font-bold text-white mb-2">Nenhum anúncio ainda</h3>
              <p className="text-gray-400 mb-6">Crie seu primeiro anúncio para comunicar com seus membros</p>
              <button onClick={openCreateModal} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Criar Primeiro Anúncio
              </button>
            </div>
          ) : (
            announcements.map((ann) => (
              <div key={ann._id} className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/30 hover:border-purple-500/50 transition-all">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-bold text-xl truncate">{ann.title}</h3>
                      {getStatusBadge(ann.status)}
                    </div>
                    <p className="text-gray-300 mb-4 line-clamp-2">{ann.message}</p>
                    
                    {/* Preview of embed if enabled */}
                    {ann.embed?.enabled && (
                      <div className="mb-4 p-4 rounded-lg border-l-4" style={{ borderColor: ann.embed.color, backgroundColor: 'rgba(0,0,0,0.3)' }}>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-white font-semibold">{ann.title}</p>
                            <p className="text-gray-300 text-sm mt-1">{ann.message.slice(0, 100)}...</p>
                            {ann.embed.footer && <p className="text-gray-500 text-xs mt-2">{ann.embed.footer}</p>}
                          </div>
                          {ann.embed.thumbnail && (
                            <img src={ann.embed.thumbnail} alt="" className="w-16 h-16 rounded object-cover" />
                          )}
                        </div>
                        {ann.embed.image && (
                          <img src={ann.embed.image} alt="" className="mt-3 rounded max-h-40 object-cover w-full" />
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span>📍 {getChannelName(ann.channelId)}</span>
                      {ann.scheduledFor && <span>📅 {new Date(ann.scheduledFor).toLocaleString('pt-BR')}</span>}
                      {ann.sentAt && <span>✅ Enviado: {new Date(ann.sentAt).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {ann.status === 'sent' && (
                      <>
                        <button onClick={() => openEditModal(ann)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
                          ✏️ Editar
                        </button>
                        <button onClick={() => resendAnnouncement(ann)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2">
                          🔄 Reenviar
                        </button>
                      </>
                    )}
                    {ann.status === 'pending' && (
                      <button onClick={() => openEditModal(ann)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
                        ✏️ Editar
                      </button>
                    )}
                    <button onClick={() => deleteAnnouncement(ann._id)} className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 text-sm flex items-center gap-2">
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl p-6 max-w-3xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                📢 {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio'}
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Side */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-white mb-2 font-medium">Título *</label>
                    <input 
                      type="text" 
                      value={formData.title} 
                      onChange={(e) => setFormData({...formData, title: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      placeholder="Título do anúncio"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white mb-2 font-medium">Mensagem *</label>
                    <textarea 
                      value={formData.message} 
                      onChange={(e) => setFormData({...formData, message: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none h-32 resize-none"
                      placeholder="Conteúdo do anúncio..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white mb-2 font-medium">Canal *</label>
                    <select 
                      value={formData.channelId} 
                      onChange={(e) => setFormData({...formData, channelId: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Selecione um canal</option>
                      {channels.map(c => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                    {loadingChannels && <p className="text-gray-500 text-sm mt-1">Carregando canais...</p>}
                  </div>

                  {/* Send Now vs Schedule */}
                  {!editingAnnouncement && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={sendNow} 
                          onChange={() => setSendNow(true)} 
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span className="text-white">Enviar agora</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={!sendNow} 
                          onChange={() => setSendNow(false)} 
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span className="text-white">Agendar</span>
                      </label>
                    </div>
                  )}

                  {!sendNow && (
                    <div>
                      <label className="block text-white mb-2 font-medium">Data/Hora</label>
                      <input 
                        type="datetime-local" 
                        value={formData.scheduledFor} 
                        onChange={(e) => setFormData({...formData, scheduledFor: e.target.value})} 
                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="border-t border-gray-700 pt-4">
                    <label className="flex items-center gap-3 mb-4 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.embedEnabled} 
                        onChange={(e) => setFormData({...formData, embedEnabled: e.target.checked})} 
                        className="w-5 h-5 accent-purple-500"
                      />
                      <span className="text-white font-medium">Usar Embed (visual melhorado)</span>
                    </label>
                    
                    {formData.embedEnabled && (
                      <div className="space-y-3 pl-4 border-l-2 border-purple-500/30">
                        <div>
                          <label className="block text-gray-300 mb-1 text-sm">Cor do Embed</label>
                          <input 
                            type="color" 
                            value={formData.embedColor} 
                            onChange={(e) => setFormData({...formData, embedColor: e.target.value})} 
                            className="w-16 h-10 bg-gray-700 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 mb-1 text-sm">Ícone/Thumbnail (URL)</label>
                          <input 
                            type="text" 
                            value={formData.embedThumbnail} 
                            onChange={(e) => setFormData({...formData, embedThumbnail: e.target.value})} 
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                            placeholder="https://exemplo.com/icone.png"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 mb-1 text-sm">Banner/Imagem (URL)</label>
                          <input 
                            type="text" 
                            value={formData.embedImage} 
                            onChange={(e) => setFormData({...formData, embedImage: e.target.value})} 
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                            placeholder="https://exemplo.com/banner.png"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 mb-1 text-sm">Rodapé</label>
                          <input 
                            type="text" 
                            value={formData.embedFooter} 
                            onChange={(e) => setFormData({...formData, embedFooter: e.target.value})} 
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                            placeholder="Texto do rodapé"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Side */}
                <div>
                  <label className="block text-white mb-2 font-medium">Preview</label>
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 min-h-[300px]">
                    {formData.embedEnabled ? (
                      <div className="rounded-lg border-l-4 p-4" style={{ borderColor: formData.embedColor, backgroundColor: 'rgba(0,0,0,0.3)' }}>
                        <div className="flex gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold">{formData.title || 'Título do Anúncio'}</p>
                            <p className="text-gray-300 text-sm mt-2 whitespace-pre-wrap break-words">{formData.message || 'Mensagem do anúncio aparecerá aqui...'}</p>
                            {formData.embedFooter && (
                              <p className="text-gray-500 text-xs mt-4 flex items-center gap-2">
                                {formData.embedFooter}
                              </p>
                            )}
                          </div>
                          {formData.embedThumbnail && (
                            <img src={formData.embedThumbnail} alt="" className="w-20 h-20 rounded object-cover flex-shrink-0" />
                          )}
                        </div>
                        {formData.embedImage && (
                          <img src={formData.embedImage} alt="" className="mt-4 rounded max-h-48 w-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-300 whitespace-pre-wrap">
                        <p className="font-bold">{formData.title || 'Título'}</p>
                        <p className="mt-2">{formData.message || 'Mensagem...'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={createOrUpdateAnnouncement} 
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  {editingAnnouncement ? '💾 Salvar Alterações' : (sendNow ? '🚀 Enviar Agora' : '📅 Agendar')}
                </button>
                <button 
                  onClick={() => { setShowModal(false); resetForm(); }} 
                  className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-all"
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
