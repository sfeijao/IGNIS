'use client';

import { useState, useEffect } from 'react';
import { useGuildId } from '@/lib/guild';
import { api } from '@/lib/apiClient';
import { useToast } from './Toaster';

interface TicketCategory {
  _id: string;
  name: string;
  emoji: string;
  welcomeMessage?: string;
}

interface Channel {
  id: string;
  name: string;
  type?: string;
}

interface Category {
  id: string;
  name: string;
}

interface PanelFormData {
  title: string;
  description: string;
  icon_url: string;
  banner_url: string;
  channel_id: string;
  target_category_id: string;
  selected_categories: string[];
  template: string;
  theme: string;
}

export default function PanelCreator({ onClose, existingPanel }: { onClose: () => void; existingPanel?: any }) {
  const guildId = useGuildId();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados disponíveis
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverCategories, setServerCategories] = useState<Category[]>([]);

  // Formulário
  const [formData, setFormData] = useState<PanelFormData>({
    title: existingPanel?.title || '',
    description: existingPanel?.description || '',
    icon_url: existingPanel?.icon_url || '',
    banner_url: existingPanel?.banner_url || '',
    channel_id: existingPanel?.channel_id || '',
    target_category_id: existingPanel?.target_category_id || '',
    selected_categories: existingPanel?.selected_categories || [],
    template: existingPanel?.template || 'classic',
    theme: existingPanel?.theme || 'dark'
  });

  useEffect(() => {
    if (!guildId) return;
    loadData();
  }, [guildId]);

  const loadData = async () => {
    if (!guildId) return;

    try {
      setLoading(true);

      // Buscar categorias de tickets
      const categoriesRes = await fetch(`/api/guild/${guildId}/ticket-categories`);
      const categoriesData = await categoriesRes.json();
      if (categoriesData.success) {
        setTicketCategories(categoriesData.categories || []);
      }

      // Buscar canais
      const channelsRes = await fetch(`/api/guild/${guildId}/channels`);
      const channelsData = await channelsRes.json();
      if (channelsData.success) {
        setChannels(channelsData.channels || []);
      }

      // Buscar categorias do servidor
      const categoriesServerRes = await fetch(`/api/guild/${guildId}/categories`);
      const categoriesServerData = await categoriesServerRes.json();
      if (categoriesServerData.success) {
        setServerCategories(categoriesServerData.categories || []);
      }

    } catch (err) {
      toast({ type: 'error', title: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_categories: prev.selected_categories.includes(categoryId)
        ? prev.selected_categories.filter(id => id !== categoryId)
        : [...prev.selected_categories, categoryId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guildId) return;

    // Validações
    if (!formData.channel_id) {
      toast({ type: 'error', title: 'Seleciona o canal' });
      return;
    }

    if (!formData.target_category_id) {
      toast({ type: 'error', title: 'Seleciona a categoria do servidor' });
      return;
    }

    if (formData.selected_categories.length === 0) {
      toast({ type: 'error', title: 'Seleciona pelo menos uma categoria de ticket' });
      return;
    }

    try {
      setSaving(true);

      const endpoint = existingPanel
        ? `/api/guild/${guildId}/panels/${existingPanel._id}`
        : `/api/guild/${guildId}/panels`;

      const method = existingPanel ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast({ type: 'success', title: existingPanel ? 'Painel atualizado!' : 'Painel criado!' });
        onClose();
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error });
      }

    } catch (err) {
      toast({ type: 'error', title: 'Erro ao guardar painel' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl p-8 max-w-4xl w-full mx-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {existingPanel ? 'Editar Painel' : 'Criar Novo Painel'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Configuração Visual */}
          <section className="bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🎨</span> Configuração Visual
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Título do Painel</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Centro de Suporte"
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Template</label>
                <select
                  value={formData.template}
                  onChange={e => setFormData(prev => ({ ...prev, template: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="classic">Clássico</option>
                  <option value="compact">Compacto</option>
                  <option value="premium">Premium</option>
                  <option value="minimal">Minimal</option>
                  <option value="gamer">Gamer</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Mensagem do Painel</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreve o propósito do painel..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ícone (URL)</label>
                <input
                  type="url"
                  value={formData.icon_url}
                  onChange={e => setFormData(prev => ({ ...prev, icon_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Canto superior direito</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Banner (URL)</label>
                <input
                  type="url"
                  value={formData.banner_url}
                  onChange={e => setFormData(prev => ({ ...prev, banner_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Parte inferior</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tema</label>
                <select
                  value={formData.theme}
                  onChange={e => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                </select>
              </div>
            </div>
          </section>

          {/* Configuração de Destino */}
          <section className="bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📍</span> Configuração de Destino
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Canal do Painel *</label>
                <select
                  value={formData.channel_id}
                  onChange={e => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecionar canal...</option>
                  {channels.filter(ch => {
                    const type = String(ch.type || '0');
                    return type === '0' || type === 'Text' || type === 'GUILD_TEXT' || type === '5' || type === 'Announcement';
                  }).map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Onde o painel será enviado</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categoria dos Tickets *</label>
                <select
                  value={formData.target_category_id}
                  onChange={e => setFormData(prev => ({ ...prev, target_category_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecionar categoria...</option>
                  {serverCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Onde os tickets serão criados</p>
              </div>
            </div>
          </section>

          {/* Seleção de Categorias de Tickets */}
          <section className="bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🏷️</span> Categorias a Incluir no Painel *
            </h3>

            {ticketCategories.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>Nenhuma categoria de tickets encontrada.</p>
                <p className="text-sm mt-2">Crie categorias em "Tickets → Categorias" primeiro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ticketCategories.map(category => (
                  <label
                    key={category._id}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.selected_categories.includes(category._id)
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700/50 hover:border-gray-600/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selected_categories.includes(category._id)}
                      onChange={() => handleCategoryToggle(category._id)}
                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-offset-gray-900"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{category.emoji}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {formData.selected_categories.length > 0 && (
              <p className="text-sm text-green-400 mt-4">
                ✓ {formData.selected_categories.length} categoria(s) selecionada(s)
              </p>
            )}
          </section>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  A guardar...
                </>
              ) : (
                existingPanel ? 'Atualizar Painel' : 'Criar Painel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
