const logger = require('../utils/logger');
const { MessageFlags } = require('discord.js');

function withFlags(data = {}) {
  // Normalize legacy ephemeral boolean to flags
  if (data && typeof data.ephemeral === 'boolean') {
    const copy = { ...data };
    delete copy.ephemeral;
    if (data.ephemeral) copy.flags = MessageFlags.Ephemeral;
    return copy;
  }
  return data;
}

async function ensureDeferred(interaction, data = {}) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.deferReply(withFlags(data));
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
}

async function safeReply(interaction, data = {}) {
  const payload = withFlags(data);
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    }
    return await interaction.followUp(payload);
  } catch (e) {
    try {
      if (interaction.deferred) return await interaction.editReply(payload);
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    throw e;
  }
}

async function safeFollowUp(interaction, data = {}) {
  const payload = withFlags(data);
  try {
    return await interaction.followUp(payload);
  } catch (e) {
    try {
      if (!interaction.deferred && !interaction.replied) return await interaction.reply(payload);
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    throw e;
  }
}

async function safeUpdate(interaction, data = {}) {
  const payload = withFlags(data);
  try {
    return await interaction.update(payload);
  } catch (e) {
    try {
      if (interaction.deferred) return await interaction.editReply(payload);
      if (!interaction.replied) return await interaction.reply(payload);
      return await interaction.followUp(payload);
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    throw e;
  }
}

module.exports = { ensureDeferred, safeReply, safeFollowUp, safeUpdate };
