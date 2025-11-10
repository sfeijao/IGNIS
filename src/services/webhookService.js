const fetch = require('node-fetch');
const crypto = require('crypto');
const { WebhookConfigModel } = require('../models/webhookConfig');
const logger = require('../../utils/logger');

function isHttpsUrl(u){
  try { const x = new URL(u); return x.protocol === 'https:'; } catch { return false; }
}

function getKey(){
  const s = (process.env.WEBHOOK_SECRET_KEY || '').trim();
  if(!s) return null;
  // derive 32-byte key from secret using SHA-256 to accept arbitrary string length
  return crypto.createHash('sha256').update(s).digest();
}

function encryptUrl(url){
  const key = getKey();
  if(!key) return { url, enc: null };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(url, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { url: enc.toString('base64'), enc: { alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: tag.toString('base64') } };
}

function decryptUrlFromDoc(doc){
  const secret = (process.env.WEBHOOK_SECRET_KEY || '').trim();
  // If no secret, assume stored plain in doc.url
  if(!secret) return doc.url || null;
  if(!(doc.enc && doc.enc.alg === 'aes-256-gcm' && doc.enc.iv && doc.enc.tag)) return doc.url || null;
  try {
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(doc.enc.iv, 'base64');
    const tag = Buffer.from(doc.enc.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(Buffer.from(doc.url, 'base64')), decipher.final()]).toString('utf8');
    return dec;
  } catch(e){ return null; }
}

function mask(u){
  if(!u || typeof u !== 'string') return null;
  if(u.length <= 16) return '****';
  return u.slice(0, u.length - 12).replace(/./g,'*') + u.slice(-12);
}

async function listConfigs(guildId){
  const docs = await WebhookConfigModel.find({ guildId }).lean();
  return docs.map(d => {
    const real = decryptUrlFromDoc(d);
    return {
      id: d._id.toString(),
      guildId: d.guildId,
      type: d.type,
      enabled: d.enabled,
      channelId: d.channelId || null,
      urlMasked: mask(real),
      lastOk: d.lastOk ?? null,
      lastStatus: d.lastStatus ?? null,
      lastError: d.lastError ?? null,
      lastAt: d.lastAt || null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    };
  });
}

async function createConfig(guildId, { type, url, enabled=true, channelId }){
  if(!isHttpsUrl(url)) throw new Error('URL must be HTTPS');
  const enc = encryptUrl(url);
  const doc = await WebhookConfigModel.create({ guildId, type, enabled, channelId, url: enc.url, enc: enc.enc || undefined });
  const safe = { id: doc._id.toString(), guildId, type, enabled, channelId: channelId || null, urlMasked: mask(url), lastOk: null, lastStatus: null, lastError: null, lastAt: null, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  return safe;
}

async function updateConfig(id, guildId, patch){
  const doc = await WebhookConfigModel.findOne({ _id: id, guildId });
  if(!doc) throw new Error('Not found');
  if(patch.url){ if(!isHttpsUrl(patch.url)) throw new Error('URL must be HTTPS'); const enc = encryptUrl(patch.url); doc.url = enc.url; doc.enc = enc.enc || undefined; }
  if(typeof patch.enabled === 'boolean') doc.enabled = patch.enabled;
  if(typeof patch.channelId === 'string') doc.channelId = patch.channelId;
  if(patch.type){
    const allowed = ['logs','tickets','updates','transcript','vlog','modlog','generic'];
    if(!allowed.includes(patch.type)) throw new Error('Invalid type');
    doc.type = patch.type;
  }
  await doc.save();
  const real = patch.url ? patch.url : decryptUrlFromDoc(doc) || null;
  return { id: doc._id.toString(), guildId, type: doc.type, enabled: doc.enabled, channelId: doc.channelId || null, urlMasked: mask(real), lastOk: doc.lastOk ?? null, lastStatus: doc.lastStatus ?? null, lastError: doc.lastError ?? null, lastAt: doc.lastAt || null, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

async function deleteConfig(id, guildId){
  const doc = await WebhookConfigModel.findOneAndDelete({ _id: id, guildId });
  return !!doc;
}

async function postToType(guildId, type, payload){
  const configs = await WebhookConfigModel.find({ guildId, type, enabled: true }).lean();
  const results = [];
  // Simple rate limit token bucket per dispatch batch (in-memory). Could be enhanced with Redis.
  const MAX_PARALLEL = 3;
  const queue = [...configs];
  const active = [];
  async function runOne(target) {
    let url;
    try {
      url = decryptUrlFromDoc(target); // ensure decrypted
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let attempt = 0;
      let resp;
      let lastErr;
      // exponential backoff with jitter up to 3 attempts
      while (attempt < 3) {
        try {
          resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          if (!resp.ok && (resp.status >= 500 || resp.status === 429)) {
            lastErr = new Error('Transient status ' + resp.status);
            attempt++;
            const backoff = Math.min(2000, 250 * Math.pow(2, attempt)) + Math.random() * 100;
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          break;
        } catch (e) {
          if (controller.signal.aborted) {
            lastErr = new Error('Timeout');
            break;
          }
          lastErr = e;
          attempt++;
          const backoff = Math.min(2000, 250 * Math.pow(2, attempt)) + Math.random() * 100;
          await new Promise(r => setTimeout(r, backoff));
        }
      }
      clearTimeout(timeout);
      const ms = Date.now() - start;
      if (resp && resp.ok) {
        await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: true, lastStatus: resp.status, lastError: null, lastAt: new Date() } });
        results.push({ id: target._id.toString(), status: resp.status, ok: true, ms });
      } else {
        const status = resp ? resp.status : 0;
        await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: false, lastStatus: status, lastError: lastErr ? (lastErr.message || 'error') : 'error', lastAt: new Date() } });
        results.push({ id: target._id.toString(), status, ok: false, error: lastErr ? lastErr.message : 'error', ms });
      }
    } catch (e) {
      await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: false, lastStatus: 0, lastError: e.message || 'exception', lastAt: new Date() } });
      results.push({ id: target._id.toString(), status: 0, ok: false, error: e.message || 'exception' });
    }
  }
  while (queue.length > 0 || active.length > 0) {
    while (active.length < MAX_PARALLEL && queue.length > 0) {
      const next = queue.shift();
      const p = runOne(next).then(() => {
        const idx = active.indexOf(p);
        if (idx >= 0) active.splice(idx, 1);
      });
      active.push(p);
    }
    if (active.length > 0) {
      await Promise.race(active);
    }
  }
  return results;
}

module.exports = { listConfigs, createConfig, updateConfig, deleteConfig, postToType };
// Bulk post to ALL enabled webhooks regardless of type
async function postToAll(guildId, payload){
  // Reuse postToType logic by selecting all and simulating a unified queue
  const configs = await WebhookConfigModel.find({ guildId, enabled: true }).lean();
  const results = [];
  const MAX_PARALLEL = 3;
  const queue = [...configs];
  const active = [];
  async function runOne(target){
    let url;
    try {
      url = decryptUrlFromDoc(target);
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(()=> controller.abort(), 10000);
      let attempt = 0; let resp; let lastErr;
      while (attempt < 3){
        try {
          resp = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
          if(!resp.ok && (resp.status >= 500 || resp.status === 429)){
            lastErr = new Error('Transient status ' + resp.status);
            attempt++; const backoff = Math.min(2000, 250 * Math.pow(2, attempt)) + Math.random()*100; await new Promise(r=> setTimeout(r, backoff)); continue;
          }
          break;
        } catch(e){
          if(controller.signal.aborted){ lastErr = new Error('Timeout'); break; }
            lastErr = e; attempt++; const backoff = Math.min(2000, 250 * Math.pow(2, attempt)) + Math.random()*100; await new Promise(r=> setTimeout(r, backoff));
        }
      }
      clearTimeout(timeout);
      const ms = Date.now() - start;
      if(resp && resp.ok){
        await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: true, lastStatus: resp.status, lastError: null, lastAt: new Date() } });
        results.push({ id: target._id.toString(), type: target.type, status: resp.status, ok: true, ms });
      } else {
        const status = resp ? resp.status : 0;
        await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: false, lastStatus: status, lastError: lastErr ? (lastErr.message||'error') : 'error', lastAt: new Date() } });
        results.push({ id: target._id.toString(), type: target.type, status, ok: false, error: lastErr ? lastErr.message : 'error', ms });
      }
    } catch(e){
      await WebhookConfigModel.updateOne({ _id: target._id }, { $set: { lastOk: false, lastStatus: 0, lastError: e.message || 'exception', lastAt: new Date() } });
      results.push({ id: target._id.toString(), type: target.type, status: 0, ok:false, error: e.message || 'exception' });
    }
  }
  while(queue.length > 0 || active.length > 0){
    while(active.length < MAX_PARALLEL && queue.length > 0){
      const next = queue.shift();
      const p = runOne(next).then(()=> { const idx = active.indexOf(p); if(idx>=0) active.splice(idx,1); });
      active.push(p);
    }
    if(active.length > 0) await Promise.race(active);
  }
  return results;
}

module.exports.postToAll = postToAll;

// Test a single webhook by id; if OK, enable it. Always update last* fields.
async function testAndActivate(id, guildId, payload){
  const doc = await WebhookConfigModel.findOne({ _id: id, guildId });
  if (!doc) throw new Error('Not found');
  const url = decryptUrlFromDoc(doc);
  if (!url) throw new Error('Invalid URL');
  const body = payload && typeof payload === 'object' ? payload : { test: true, at: Date.now(), source: 'IGNIS' };
  let ok = false; let status = 0; let lastErr = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    status = resp.status;
    ok = resp.ok;
    if (!ok) lastErr = `status ${status}`;
  } catch (e) {
    lastErr = e?.message || 'network error';
  } finally { clearTimeout(timeout); }
  doc.lastOk = !!ok;
  doc.lastStatus = status || 0;
  doc.lastError = ok ? null : (lastErr || 'error');
  doc.lastAt = new Date();
  if (ok) doc.enabled = true;
  await doc.save();
  return {
    id: doc._id.toString(),
    guildId: doc.guildId,
    type: doc.type,
    enabled: doc.enabled,
    channelId: doc.channelId || null,
    urlMasked: mask(url),
    lastOk: doc.lastOk ?? null,
    lastStatus: doc.lastStatus ?? null,
    lastError: doc.lastError ?? null,
    lastAt: doc.lastAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

module.exports.testAndActivate = testAndActivate;
