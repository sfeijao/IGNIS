const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.GuildUpdate,
  once: false,
  /**
   * Auto-refresh ticket panels when guild icon/name changes.
   * Rebuilds embeds for stored panels using current template and theme,
   * updating images (thumbnail/image) to reflect the new server identity.
   */
  async execute(oldGuild, newGuild) {
    try {
      const logger = require('../utils/logger');
      const iconChanged = oldGuild?.icon !== newGuild?.icon;
      const nameChanged = oldGuild?.name !== newGuild?.name;
      if (!iconChanged && !nameChanged) return;

      const client = newGuild.client;
      const guildId = newGuild.id;

      // Check guild setting: auto-refresh panels toggle (default: enabled)
      let enabled = true;
      try {
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(guildId).catch(() => ({}));
        if (cfg && Object.prototype.hasOwnProperty.call(cfg, 'autoRefreshPanels')) {
          enabled = !!cfg.autoRefreshPanels;
        }
      } catch {}
      if (!enabled) return;

      // Resolve panels from storage (Mongo preferred, fallback to SQLite if configured)
      let panels = [];
      let preferSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
      try {
        if (!preferSqlite) {
          const { isReady } = require('../utils/db/mongoose');
          if (isReady()) {
            const { PanelModel } = require('../utils/db/models');
            panels = await PanelModel.find({ guild_id: guildId, type: { $in: ['tickets','verification'] } }).lean();
          } else {
            preferSqlite = true;
          }
        }
        if (preferSqlite) {
          const sqlite = require('../utils/storage-sqlite');
          const t = await sqlite.getPanelsByType(guildId, 'tickets');
          const v = await sqlite.getPanelsByType(guildId, 'verification');
          panels = [...(Array.isArray(t)?t:[]), ...(Array.isArray(v)?v:[])];
        }
      } catch (e) {
        try {
          const sqlite = require('../utils/storage-sqlite');
          const t = await sqlite.getPanelsByType(guildId, 'tickets');
          const v = await sqlite.getPanelsByType(guildId, 'verification');
          panels = [...(Array.isArray(t)?t:[]), ...(Array.isArray(v)?v:[])];
        } catch {}
      }
      if (!Array.isArray(panels) || panels.length === 0) return;

      const iconThumb = newGuild.iconURL({ size: 256, dynamic: true }) || null;
      const iconHero = newGuild.iconURL({ size: 1024, dynamic: true }) || null;
      const color = 0x7C3AED; // default dark theme accent

      // Helper to build payload by template (minimal rebuild focused on images and button layout)
      function buildPayload(tpl, theme) {
        const t = (tpl || 'classic');
        const th = (theme || 'dark');
        const embed = new EmbedBuilder().setColor(th === 'light' ? 0x60A5FA : color);
        let rows = [];
        if (t === 'compact') {
          embed.setTitle('🎫 Tickets • Compacto').setDescription('Escolhe abaixo e abre um ticket privado.');
          if (iconThumb) embed.setThumbnail(iconThumb);
          rows = [ new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:support').setLabel('Suporte').setEmoji('🎫').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
          ) ];
        } else if (t === 'minimal') {
          embed.setTitle('🎫 Abrir ticket').setDescription('Carrega num botão para abrir um ticket.');
          if (iconThumb) embed.setThumbnail(iconThumb);
          rows = [ new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Abrir Ticket').setEmoji('🎟️').setStyle(ButtonStyle.Primary)
          ) ];
        } else if (t === 'premium') {
          embed
            .setTitle('🎫 Centro de Suporte • Premium')
            .setDescription('Serviço prioritário, acompanhamento dedicado e histórico guardado.');
          if (iconThumb) embed.setThumbnail(iconThumb);
          const r1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:vip').setLabel('VIP / Premium').setEmoji('👑').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
          );
          const r2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary)
          );
          rows = [r1, r2];
        } else if (t === 'gamer') {
          embed
            .setTitle('Precisas de ajuda? Clica aí 👇')
            .setDescription('Escolhe o tipo de ajuda abaixo. Visual gamer, chill e funcional.');
          if (iconHero) embed.setImage(iconHero); else if (iconThumb) embed.setThumbnail(iconThumb);
          rows = [ new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('👤').setStyle(ButtonStyle.Secondary)
          ) ];
        } else {
          // classic
          embed
            .setTitle('🎫 Centro de Suporte')
            .setDescription('Escolhe o departamento abaixo para abrir um ticket privado com a equipa.');
          if (iconThumb) embed.setThumbnail(iconThumb);
          const r1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
          );
          const r2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('🧾').setStyle(ButtonStyle.Secondary)
          );
          rows = [r1, r2];
        }
        return { embeds: [embed], components: rows };
      }

      for (const p of panels) {
        try {
          const ch = client.channels.cache.get(p.channel_id) || await client.channels.fetch(p.channel_id).catch(() => null);
          if (!ch || !ch.messages?.fetch || !p.message_id) continue;
          const msg = await ch.messages.fetch(p.message_id).catch(() => null);
          if (!msg) continue;
          if (p.type === 'verification') {
            // Preserve existing content/components; just ensure embed has server thumbnail
            const currentEmbed = Array.isArray(msg.embeds) && msg.embeds[0] ? msg.embeds[0] : null;
            let embed;
            if (currentEmbed) {
              embed = EmbedBuilder.from(currentEmbed);
            } else {
              embed = new EmbedBuilder()
                .setTitle('🔒 Verificação do Servidor')
                .setDescription('Clica em Verificar para concluir e ganhar acesso aos canais.')
                .setColor(color);
            }
            if (iconThumb) embed.setThumbnail(iconThumb); else embed.setThumbnail(null);
            const editPayload = { embeds: [embed] };
            if (Array.isArray(msg.components) && msg.components.length) {
              editPayload.components = msg.components;
            }
            await msg.edit(editPayload).catch(() => {});
          } else {
            const payload = buildPayload(p.template, p.theme);
            await msg.edit(payload).catch(() => {});
          }
        } catch (e) {
          // Best-effort, continue
        }
      }

      try { require('../utils/logger').info(`🔁 Painéis de ${newGuild.name} atualizados após mudança de ${iconChanged?'ícone':''}${iconChanged&&nameChanged?' e ':''}${nameChanged?'nome':''}.`); } catch {}
    } catch {}
  }
};
