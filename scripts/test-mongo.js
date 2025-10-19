#!/usr/bin/env node
/*
  Quick MongoDB connection tester with helpful diagnostics.

  Usage:
    node scripts/test-mongo.js              # uses process.env.MONGO_URI or MONGODB_URI
    node scripts/test-mongo.js <mongo_uri>  # test a specific URI pasted as arg
*/

const dns = require('dns');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
require('dotenv').config();

function maskMongoUri(uri) {
  try {
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

function parseSrvHost(uri){
  try {
    const m = uri.match(/^mongodb\+srv:\/\/[^@]+@([^/?#]+)(?:[/?#].*)?$/i) || uri.match(/^mongodb\+srv:\/\/([^/?#]+)(?:[/?#].*)?$/i);
    return m ? m[1] : null;
  } catch { return null; }
}

async function resolveSrv(host){
  const rr = `_mongodb._tcp.${host}`;
  try {
    const res = await dns.promises.resolveSrv(rr);
    return { ok: true, records: res };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function resolveTxt(host){
  try {
    const res = await dns.promises.resolveTxt(host);
    return { ok: true, records: res };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function testWithMongoDriver(uri, dbName){
  let client;
  try {
    const opts = {};
    if (uri && !/mongodb\+srv:/.test(uri) && dbName && !/\/[^/?]+/.test(uri.replace(/^mongodb:\/\//,''))) {
      // No path database in URI: the driver will use 'test' by default; pass dbName via db() after connect
    }
    client = new MongoClient(uri, opts);
    await client.connect();
    const db = client.db(dbName || 'IGNIS');
    await db.command({ ping: 1 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    try { await client?.close(); } catch {}
  }
}

async function testWithMongoose(uri, dbName){
  try {
    const hasDbPath = /mongodb(?:\+srv)?:\/\/[^/]+\/.+/.test(uri);
    const connOpts = { serverSelectionTimeoutMS: 8000 };
    if (!hasDbPath && dbName) connOpts.dbName = dbName;
    await mongoose.connect(uri, connOpts);
    await mongoose.connection.db.admin().ping();
    await mongoose.disconnect();
    return { ok: true };
  } catch (e) {
    try { await mongoose.disconnect(); } catch {}
    return { ok: false, error: e.message || String(e) };
  }
}

(async () => {
  const inputUri = process.argv[2];
  const envUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  const uri = (inputUri || envUri || '').trim();
  const dbName = process.env.MONGO_DB_NAME || 'IGNIS';

  if (!uri) {
    console.log('No MONGO_URI provided (env or arg).');
    process.exit(1);
  }

  console.log('--- MongoDB Connection Tester ---');
  console.log('URI:', maskMongoUri(uri));
  console.log('DB Name:', dbName);

  if (/mongodb\+srv:/.test(uri)) {
    const host = parseSrvHost(uri);
    console.log('SRV Host:', host || '(not parsed)');
    if (host) {
      const [srv, txt] = await Promise.all([ resolveSrv(host), resolveTxt(host) ]);
      console.log('SRV resolve:', srv.ok ? srv.records : `ERR: ${srv.error}`);
      console.log('TXT resolve:', txt.ok ? txt.records : `ERR: ${txt.error}`);
    }
  }

  console.log('\nTesting with mongodb driver...');
  const d1 = await testWithMongoDriver(uri, dbName);
  console.log(d1.ok ? 'OK' : `FAIL: ${d1.error}`);

  console.log('\nTesting with mongoose...');
  const d2 = await testWithMongoose(uri, dbName);
  console.log(d2.ok ? 'OK' : `FAIL: ${d2.error}`);

  process.exit(d1.ok && d2.ok ? 0 : 2);
})();
