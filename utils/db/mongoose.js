const mongoose = require('mongoose');

let isConnected = false;

async function connect(uri) {
  if (isConnected) return mongoose.connection;
  if (!uri) throw new Error('MONGO_URI não definido');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
  isConnected = true;
  return mongoose.connection;
}

// Sincronizar flag com eventos de ligação
try {
  mongoose.connection.on('connected', () => { isConnected = true; });
  mongoose.connection.on('disconnected', () => { isConnected = false; });
  mongoose.connection.on('error', () => { /* noop */ });
} catch {}

function isReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { mongoose, connect, isReady };
