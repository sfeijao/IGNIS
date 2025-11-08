const mongoose = require('mongoose');

// Types allowed: transcript, vlog, modlog, generic
// url must be HTTPS; channelId optional (used if we internally fetch transcript and send message then webhook)
// For security, we may later encrypt the URL; for now store plain and mask on output.
const webhookConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['transcript','vlog','modlog','generic'] },
  // Encrypted URL blob if encryption key active; else plain URL
  url: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Encryption metadata (optional)
  enc: {
    alg: { type: String }, // e.g. aes-256-gcm
    iv: { type: String },  // base64
    tag: { type: String }  // base64 auth tag
  },
  // Minimal status history
  lastOk: { type: Boolean },
  lastStatus: { type: Number },
  lastError: { type: String },
  lastAt: { type: Date }
});

webhookConfigSchema.pre('save', function(next){
  this.updatedAt = new Date();
  next();
});

function maskUrl(u){
  if(!u || typeof u !== 'string') return null;
  if(u.length <= 16) return '****';
  return u.slice(0, u.length - 12).replace(/./g,'*') + u.slice(-12);
}

webhookConfigSchema.methods.getDecryptedUrl = function(){
  const secret = (process.env.WEBHOOK_SECRET_KEY || '').trim();
  if(!secret) return this.url; // stored plain
  if(!(this.enc && this.enc.alg === 'aes-256-gcm' && this.enc.iv && this.enc.tag)) return this.url;
  try {
    const crypto = require('crypto');
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(this.enc.iv, 'base64');
    const tag = Buffer.from(this.enc.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(Buffer.from(this.url, 'base64')), decipher.final()]).toString('utf8');
    return dec;
  } catch(e){ return null; }
};

webhookConfigSchema.methods.toSafeJSON = function(){
  const rawUrl = this.getDecryptedUrl();
  return {
    id: this._id.toString(),
    guildId: this.guildId,
    type: this.type,
    enabled: this.enabled,
    channelId: this.channelId || null,
    urlMasked: maskUrl(rawUrl),
    lastOk: this.lastOk ?? null,
    lastStatus: this.lastStatus ?? null,
    lastAt: this.lastAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const WebhookConfigModel = mongoose.model('WebhookConfig', webhookConfigSchema);
module.exports = { WebhookConfigModel };
