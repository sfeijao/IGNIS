'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
  const params = useParams();
  const guildId = params?.guildId as string;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (guildId) fetchEvents();
  }, [guildId]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/guild/${guildId}/events`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    try {
      const data = {
        ...formData,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null
      };

      const res = await fetch(`/api/guild/${guildId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ title: '', description: '', startDate: '', endDate: '', channelId: '', maxParticipants: '', imageUrl: '' });
        fetchEvents();
        alert('✅ Evento criado!');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Deletar este evento?')) return;
    try {
      await fetch(`/api/guild/${guildId}/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchEvents();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div></div>;
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
            <div className="col-span-2 bg-gray-800/50 rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400">Nenhum evento agendado</p>
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
