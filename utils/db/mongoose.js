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

module.exports = { mongoose, connect };
