'use client';

import { useState } from 'react';
import { useGuildId } from '@/lib/guild';
import { useSafeAPI, safeFetch } from '@/lib/useSafeAPI';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateComponents';

interface Event {
  _id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  participants: string[];
  maxParticipants?: number;
  imageUrl?: string;
  createdBy: string;
  createdAt: Date;
}

export default function EventsPage() {
  const guildId = useGuildId();

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    channelId: '',
    maxParticipants: '',
    imageUrl: ''
  });

  const { data, loading, error, refetch } = useSafeAPI<{ success: boolean; events: Event[] }>(
    () => safeFetch(`/api/guild/${guildId}/events`),
    [guildId],
    { skip: !guildId }
  );

  const events = data?.events || [];

  const createEvent = async () => {
    try {
      const payload = {
        ...formData,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null
      };

      await safeFetch(`/api/guild/${guildId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      setFormData({ title: '', description: '', startDate: '', endDate: '', channelId: '', maxParticipants: '', imageUrl: '' });
      refetch();
      alert('✅ Evento criado!');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao criar evento'}`);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Deletar este evento?')) return;
    try {
      await safeFetch(`/api/guild/${guildId}/events/${eventId}`, { method: 'DELETE' });
      refetch();
      alert('✅ Evento deletado!');
    } catch (err) {
      alert(`❌ Erro: ${err instanceof Error ? err.message : 'Falha ao deletar evento'}`);
    }
  };

  if (!guildId) {
    return <EmptyState icon="🏠" title="Selecione um servidor" description="Escolha um servidor na sidebar para gerenciar eventos" />;
  }

  if (loading) {
    return <LoadingState message="Carregando eventos..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">📅 Sistema de Eventos</h1>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700">
            ➕ Criar Evento
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {events.length === 0 ? (
            <div className="col-span-2">
              <EmptyState
                icon="📅"
                title="Nenhum evento agendado"
                description="Crie seu primeiro evento para começar"
                action={{ label: '➕ Criar Evento', onClick: () => setShowModal(true) }}
              />
            </div>
          ) : (
            events.map((event) => (
              <div key={event._id} className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
                {event.imageUrl && (
                  <img src={event.imageUrl} alt={event.title} className="w-full h-48 object-cover rounded-lg mb-4"/>
                )}
                <h3 className="text-white font-bold text-2xl mb-2">📅 {event.title}</h3>
                <p className="text-gray-300 mb-4">{event.description}</p>
                <div className="space-y-2 mb-4">
                  <p className="text-white">
                    🕐 Início: <span className="text-purple-400">{new Date(event.startDate).toLocaleString('pt-BR')}</span>
                  </p>
                  {event.endDate && (
                    <p className="text-white">
                      🏁 Fim: <span className="text-purple-400">{new Date(event.endDate).toLocaleString('pt-BR')}</span>
                    </p>
                  )}
                  <p className="text-white">
                    👥 Participantes: <span className="text-purple-400">{event.participants.length}{event.maxParticipants ? `/${event.maxParticipants}` : ''}</span>
                  </p>
                </div>
                <button
                  onClick={() => deleteEvent(event._id)}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                >
                  🗑️ Deletar Evento
                </button>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">➕ Criar Evento</h2>
              <div className="space-y-4">
                <div><label className="block text-white mb-2">Título</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Descrição</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg h-24"/></div>
                <div><label className="block text-white mb-2">Data/Hora Início</label><input type="datetime-local" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Data/Hora Fim (opcional)</label><input type="datetime-local" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">Canal ID</label><input type="text" value={formData.channelId} onChange={(e) => setFormData({...formData, channelId: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg" placeholder="123456789012345678"/></div>
                <div><label className="block text-white mb-2">Máx Participantes (opcional)</label><input type="number" value={formData.maxParticipants} onChange={(e) => setFormData({...formData, maxParticipants: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div><label className="block text-white mb-2">URL Imagem (opcional)</label><input type="text" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"/></div>
                <div className="flex gap-3">
                  <button onClick={createEvent} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg">Criar</button>
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
