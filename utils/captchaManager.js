const { randomInt } = require('crypto');
const store = new Map(); // key: guildId:userId -> { code, createdAt, mode }

function makeKey(guildId, userId) { return `${guildId}:${userId}`; }

function generateCode(mode = 'easy') {
  const sets = {
    easy: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // no I,O,1,0
    medium: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',
    hard: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%'
  };
  const len = mode === 'hard' ? 8 : mode === 'medium' ? 6 : 4;
  const chars = sets[mode] || sets.easy;
  let out = '';
  for (let i = 0; i < len; i++) out += chars[randomInt(0, chars.length)];
  return out;
}

function create(guildId, userId, mode = 'easy') {
  const code = generateCode(mode);
  const data = { code, createdAt: Date.now(), mode };
  store.set(makeKey(guildId, userId), data);
  return data;
}

function get(guildId, userId) {
  return store.get(makeKey(guildId, userId)) || null;
}

function refresh(guildId, userId, mode = 'easy') {
  const data = create(guildId, userId, mode);
  return data;
}

function clear(guildId, userId) {
  store.delete(makeKey(guildId, userId));
}

function validate(guildId, userId, input) {
  const item = get(guildId, userId);
  if (!item) return { ok: false, reason: 'not_found' };
  // 5 minutes TTL
  if (Date.now() - item.createdAt > 5 * 60 * 1000) {
    clear(guildId, userId);
    return { ok: false, reason: 'expired' };
  }
  const normalized = String(input || '').trim();
  const ok = normalized === item.code;
  if (ok) clear(guildId, userId);
  return { ok, reason: ok ? null : 'mismatch' };
}

module.exports = { create, get, refresh, clear, validate };
