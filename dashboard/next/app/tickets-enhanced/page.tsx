'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Ticket {
  _id: string;
  ticketNumber: number;
  channelId: string;
  ownerId: string;
  categoryName: string;
  status: 'open' | 'pending' | 'answered' | 'closed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string;
  reason: string;
  claimedBy?: string;
  rating?: {
    score: number;
    feedback?: string;
  };
  responseTimes: {
    firstResponseTime?: number;
  };
  createdAt: Date;
  closedAt?: Date;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  averageRating: number;
  averageResolutionTime: number;
  totalClosed: number;
}

export default function TicketsEnhancedPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '', categoryId: '' });

  useEffect(() => {
    if (guildId) fetchData();
  }, [guildId, filter]);

  const fetchData = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filter.status) queryParams.append('status', filter.status);
      if (filter.priority) queryParams.append('priority', filter.priority);
      if (filter.categoryId) queryParams.append('categoryId', filter.categoryId);

      const [ticketsRes, statsRes] = await Promise.all([
        fetch(`/api/guild/${guildId}/tickets-enhanced?${queryParams}`, { credentials: 'include' }),
        fetch(`/api/guild/${guildId}/tickets-enhanced/stats`, { credentials: 'include' })
      ]);

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeTicket = async (ticketId: string) => {
    const reason = prompt('Motivo do fechamento:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/guild/${guildId}/tickets-enhanced/${ticketId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (res.ok) {
        fetchData();
        alert('✅ Ticket fechado!');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-green-600',
      pending: 'bg-yellow-600',
      answered: 'bg-blue-600',
      closed: 'bg-gray-600',
      archived: 'bg-purple-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500',
      normal: 'bg-blue-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500'
    };
    return colors[priority] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🎫 Tickets 2.0</h1>

        {/* Stats Cards */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
              <p className="text-purple-400 text-sm">Total Tickets</p>
              <p className="text-white text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 border border-green-500/30">
              <p className="text-green-400 text-sm">Fechados</p>
              <p className="text-white text-3xl font-bold">{stats.totalClosed}</p>
            </div>
            <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm">Tempo Médio Resolução</p>
              <p className="text-white text-3xl font-bold">{stats.averageResolutionTime}<span className="text-lg">min</span></p>
            </div>
            <div className="bg-pink-900/30 rounded-lg p-4 border border-pink-500/30">
              <p className="text-pink-400 text-sm">Avaliação Média</p>
              <p className="text-white text-3xl font-bold">{stats.averageRating}⭐</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-purple-500/30">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-white mb-2 text-sm">Status</label>
              <select value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg">
                <option value="">Todos</option>
                <option value="open">Aberto</option>
                <option value="pending">Pendente</option>
                <option value="answered">Respondido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
            <div>
              <label className="block text-white mb-2 text-sm">Prioridade</label>
              <select value={filter.priority} onChange={(e) => setFilter({...filter, priority: e.target.value})} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg">
                <option value="">Todas</option>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-purple-500/30">
              <p className="text-gray-400">Nenhum ticket encontrado</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket._id} className="bg-gray-800/50 rounded-lg p-6 border border-purple-500/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-bold text-xl">
                        #{String(ticket.ticketNumber).padStart(4, '0')} - {ticket.subject}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getStatusColor(ticket.status)}`}>
                        {ticket.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-300 mb-3">{ticket.reason || 'Sem descrição'}</p>
                    <div className="flex gap-6 text-sm text-gray-400">
                      <span>📁 {ticket.categoryName}</span>
                      <span>👤 <span className="font-mono">{ticket.ownerId}</span></span>
                      <span>📅 {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                      {ticket.responseTimes?.firstResponseTime && (
                        <span>⏱️ Resp: {ticket.responseTimes.firstResponseTime}min</span>
                      )}
                      {ticket.rating?.score && (
                        <span>⭐ {ticket.rating.score}/5</span>
                      )}
                    </div>
                  </div>
                  {ticket.status !== 'closed' && (
                    <button onClick={() => closeTicket(ticket._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">
                      🔒 Fechar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
