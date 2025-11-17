const { AttachmentBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * Consolidated transcript generation helper
 * Reduces code duplication across communityTickets.js, ticketService.ts, etc.
 */

/**
 * Fetch messages from a channel with pagination
 * @param {TextChannel} channel - Discord text channel
 * @param {number} maxMessages - Maximum messages to fetch (default: 2000)
 * @returns {Promise<Message[]>} Array of messages, sorted oldest first
 */
async function fetchChannelMessages(channel, maxMessages = 2000) {
  const messages = [];
  let lastId = undefined;
  const iterations = Math.ceil(maxMessages / 100);

  for (let i = 0; i < iterations; i++) {
    try {
      const fetchOpts = lastId ? { limit: 100, before: lastId } : { limit: 100 };
      const fetched = await channel.messages.fetch(fetchOpts).catch(() => null);
      if (!fetched || fetched.size === 0) break;

      const batch = Array.from(fetched.values());
      messages.push(...batch);

      const last = batch[batch.length - 1];
      lastId = last?.id;

      if (fetched.size < 100) break; // No more messages
    } catch (err) {
      logger.warn(`Error fetching messages batch ${i}:`, err?.message || err);
      break;
    }
  }

  // Sort oldest first
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return messages;
}

/**
 * Generate text transcript from messages
 * @param {Object} options
 * @param {Message[]} options.messages - Array of Discord messages
 * @param {string} options.ticketId - Ticket ID
 * @param {string} options.channelName - Channel name
 * @param {string} options.channelId - Channel ID
 * @param {string} options.guildName - Guild name
 * @param {string} options.closedByTag - User tag who closed
 * @param {string} options.action - Action type (closed/updated/generated)
 * @returns {string} Formatted transcript text
 */
function generateTextTranscript({ messages, ticketId, channelName, channelId, guildName, closedByTag, action = 'closed' }) {
  const header = [
    `TRANSCRIPT TICKET ${ticketId || channelName} (Canal ${channelId})`,
    `Servidor: ${guildName}`,
    `Ação: ${action} por ${closedByTag}`,
    `Gerado em: ${new Date().toISOString()}`,
    '',
    '='.repeat(80),
    ''
  ].join('\n');

  const lines = messages.map(m => {
    const ts = new Date(m.createdTimestamp).toISOString();
    const author = m.author?.tag || m.author?.id || 'Desconhecido';
    const content = (m.content || '').replace(/\n/g, ' ');
    const atts = m.attachments?.size > 0
      ? ` [anexos: ${Array.from(m.attachments.values()).map(a => a.name).join(', ')}]`
      : '';
    return `[${ts}] ${author}: ${content}${atts}`;
  });

  return header + lines.join('\n');
}

/**
 * Create AttachmentBuilder for transcript
 * @param {string} transcriptText - Transcript content
 * @param {string} filename - File name (default: transcript-{timestamp}.txt)
 * @returns {AttachmentBuilder|null} Discord attachment or null if text is empty
 */
function createTranscriptAttachment(transcriptText, filename = null) {
  if (!transcriptText || transcriptText.length === 0) return null;

  // Discord webhook limit is 25MB, be conservative
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  const buffer = Buffer.from(transcriptText, 'utf8');

  if (buffer.length > MAX_SIZE) {
    logger.warn(`Transcript too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB), truncating...`);
    const truncated = transcriptText.slice(0, MAX_SIZE - 100) + '\n\n[TRANSCRIPT TRUNCATED DUE TO SIZE]';
    return new AttachmentBuilder(Buffer.from(truncated, 'utf8'), {
      name: filename || `transcript-truncated-${Date.now()}.txt`
    });
  }

  return new AttachmentBuilder(buffer, {
    name: filename || `transcript-${Date.now()}.txt`
  });
}

/**
 * All-in-one: fetch messages, generate transcript, create attachment
 * @param {Object} options
 * @param {TextChannel} options.channel - Discord channel
 * @param {string} options.ticketId - Ticket ID
 * @param {string} options.closedByTag - User who closed
 * @param {string} options.action - Action type
 * @param {number} options.maxMessages - Max messages to fetch
 * @returns {Promise<{text: string, attachment: AttachmentBuilder|null}>}
 */
async function generateFullTranscript({ channel, ticketId, closedByTag, action = 'closed', maxMessages = 2000 }) {
  try {
    const messages = await fetchChannelMessages(channel, maxMessages);

    const text = generateTextTranscript({
      messages,
      ticketId,
      channelName: channel.name,
      channelId: channel.id,
      guildName: channel.guild?.name || 'Unknown',
      closedByTag,
      action
    });

    const attachment = createTranscriptAttachment(text, `transcript-${ticketId || channel.id}.txt`);

    return { text, attachment };
  } catch (err) {
    logger.error('Error generating full transcript:', err);
    return {
      text: `Error generating transcript: ${err?.message || err}`,
      attachment: null
    };
  }
}

module.exports = {
  fetchChannelMessages,
  generateTextTranscript,
  createTranscriptAttachment,
  generateFullTranscript
};
