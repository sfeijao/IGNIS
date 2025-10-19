const mongoose = require('mongoose');

let isConnected = false;
let lastError = null; // { code, message }

function maskMongoUri(uri) {
  try {
    // Avoid leaking credentials; only show scheme and host(s)
    // mongodb+srv://user:pass@cluster/db -> mongodb+srv://***@cluster/db
    const atIndex = uri.indexOf('@');
    const protoIndex = uri.indexOf('://');
    if (protoIndex !== -1 && atIndex !== -1 && atIndex > protoIndex) {
      const scheme = uri.substring(0, protoIndex + 3);
      const afterAt = uri.substring(atIndex + 1);
      return `${scheme}***@${afterAt}`;
    }
  } catch {}
  return '***';
}

function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return { ok: false, reason: 'não definido' };
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    return { ok: false, reason: 'deve começar por mongodb:// ou mongodb+srv://' };
  }
  if (/\s/.test(uri)) {
    return { ok: false, reason: 'contém espaços em branco' };
  }
  // Basic check for common unencoded characters in credentials
  // If these appear before the host separator '@', it's likely malformed
  const protoIndex = uri.indexOf('://');
  const atIndex = uri.indexOf('@');
  if (protoIndex !== -1 && atIndex !== -1) {
    const creds = uri.substring(protoIndex + 3, atIndex);
    if (/[#\s?/\\\[\]]/.test(creds)) {
      return { ok: false, reason: 'caracteres especiais não codificados nas credenciais (use encodeURIComponent na password)' };
    }
  }
  return { ok: true };
}

async function connect(uri) {
  if (isConnected) return mongoose.connection;
  if (!uri) throw new Error('MONGO_URI não definido');
  // Normalize whitespace/newlines that often sneak in from copy-paste
  if (typeof uri === 'string') {
    uri = uri.trim();
    // Collapse accidental internal whitespace sequences
    // Only remove spaces if they are surrounding the URI or obvious line breaks
    uri = uri.replace(/[\r\n]+/g, '');
  }

  const validation = validateMongoUri(uri);
  if (!validation.ok) {
    const masked = maskMongoUri(uri);
    const err = new Error(`MongoDB URI inválida: ${validation.reason} (uri: ${masked})`);
    err.code = 'MONGO_URI_MALFORMED';
    throw err;
  }

  // If URI has no "/db" path, allow overriding dbName via env, default to 'IGNIS'
  let connOpts = { autoIndex: true, serverSelectionTimeoutMS: 10000 };
  try {
    const hasDbPath = /mongodb(?:\+srv)?:\/\/[^/]+\/.+/.test(uri);
    if (!hasDbPath) {
      const dbName = process.env.MONGO_DB_NAME || 'IGNIS';
      connOpts.dbName = dbName;
    }
  } catch {}

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, connOpts);
    isConnected = true;
    lastError = null;
    return mongoose.connection;
  } catch (e) {
    // Reclassify common parse errors to provide clearer guidance upstream
    const message = (e && e.message) || String(e);
    if (/URI malformed|MongoParseError|Invalid connection string/i.test(message)) {
      const masked = maskMongoUri(uri);
      const err = new Error(`MongoDB URI inválida/malformada: ${message}. Sugestão: se a password tiver caracteres especiais (por ex. @ : / ? # [ ]), codifique-a com encodeURIComponent. (uri: ${masked})`);
      err.code = 'MONGO_URI_MALFORMED';
      lastError = { code: err.code, message: err.message };
      throw err;
    }
    // Authentication failures
    if (/Authentication failed|bad auth|auth failed/i.test(message)) {
      const masked = maskMongoUri(uri);
      const err = new Error(`Falha de autenticação no MongoDB: ${message}. Verifique o utilizador, password (caracteres especiais devem ser codificados) e permissões no cluster. (uri: ${masked})`);
      err.code = 'MONGO_AUTH_FAILED';
      lastError = { code: err.code, message: err.message };
      throw err;
    }
    // Network/selection failures
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Server selection timed out|getaddrinfo|Name does not resolve|connection closed/i.test(message)) {
      const masked = maskMongoUri(uri);
      const err = new Error(`Falha de ligação ao MongoDB: ${message}. Verifique Network Access no Atlas (IP allowlist), DNS, e acesso de saída do ambiente. (uri: ${masked})`);
      err.code = 'MONGO_NET_FAILED';
      lastError = { code: err.code, message: err.message };
      throw err;
    }
    lastError = { code: e && e.code || 'MONGO_UNKNOWN', message: message };
    throw e;
  }
}

// Sincronizar flag com eventos de ligação
try {
  mongoose.connection.on('connected', () => { isConnected = true; lastError = null; });
  mongoose.connection.on('disconnected', () => { isConnected = false; });
  mongoose.connection.on('error', (e) => { try { lastError = { code: e && e.code || 'MONGO_ERROR', message: (e && e.message) || String(e) }; } catch {} });
} catch {}

function isReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

function getStatus(){
  return { connected: isReady(), lastError };
}

module.exports = { mongoose, connect, isReady, getStatus };
