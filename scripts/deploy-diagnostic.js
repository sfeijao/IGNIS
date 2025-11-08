#!/usr/bin/env node
// scripts/deploy-diagnostic.js - Diagnóstico de conectividade para deploy de comandos
const dns = require('dns');
const net = require('net');
const https = require('https');
const { performance } = require('perf_hooks');

const TARGET_HOST = 'discord.com';
const TARGET_PORT = 443;
const API_ENDPOINT = '/api/v10/gateway';

function hr(ms){ return `${ms.toFixed(0)}ms`; }

async function resolveDNS(host){
  return new Promise((resolve) => {
    const start = performance.now();
    dns.lookup(host, { all: true }, (err, addresses) => {
      const time = performance.now() - start;
      if (err) return resolve({ ok:false, error: err.message, time });
      resolve({ ok:true, addresses, time });
    });
  });
}

async function testTCP(host, port){
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = net.createConnection({ host, port, timeout: 8000 });
    socket.once('connect', () => {
      const time = performance.now() - start;
      socket.destroy();
      resolve({ ok:true, time });
    });
    socket.once('timeout', () => {
      const time = performance.now() - start;
      socket.destroy();
      resolve({ ok:false, error:'TCP timeout', time });
    });
    socket.once('error', (err) => {
      const time = performance.now() - start;
      resolve({ ok:false, error: err.message, time });
    });
  });
}

async function testHTTPS(host, path){
  return new Promise((resolve) => {
    const start = performance.now();
    const req = https.request({ host, path, method: 'HEAD', timeout: 10000 }, (res) => {
      const time = performance.now() - start;
      resolve({ ok:true, status: res.statusCode, time });
    });
    req.on('timeout', () => {
      const time = performance.now() - start;
      req.destroy();
      resolve({ ok:false, error:'HTTPS timeout', time });
    });
    req.on('error', (err) => {
      const time = performance.now() - start;
      resolve({ ok:false, error: err.message, time });
    });
    req.end();
  });
}

async function main(){
  console.log('🔎 Diagnóstico de Deploy de Comandos Discord');
  console.log('============================================');

  const dnsResult = await resolveDNS(TARGET_HOST);
  console.log(`DNS (${TARGET_HOST}): ${dnsResult.ok ? 'OK' : 'FAIL'} em ${hr(dnsResult.time)}`);
  if (dnsResult.ok) {
    dnsResult.addresses.forEach(a => console.log(`  - ${a.address} (${a.family})`));
  } else {
    console.log(`  Erro DNS: ${dnsResult.error}`);
  }

  const tcpResult = await testTCP(TARGET_HOST, TARGET_PORT);
  console.log(`TCP handshake: ${tcpResult.ok ? 'OK' : 'FAIL'} em ${hr(tcpResult.time)}`);
  if (!tcpResult.ok) console.log(`  Erro TCP: ${tcpResult.error}`);

  const httpsResult = await testHTTPS(TARGET_HOST, API_ENDPOINT);
  console.log(`HTTPS HEAD ${API_ENDPOINT}: ${httpsResult.ok ? 'OK' : 'FAIL'} em ${hr(httpsResult.time)}${httpsResult.status ? ' (status '+httpsResult.status+')' : ''}`);
  if (!httpsResult.ok) console.log(`  Erro HTTPS: ${httpsResult.error}`);

  console.log('\nResumo:');
  if (dnsResult.ok && tcpResult.ok && httpsResult.ok) {
    console.log('✅ Conectividade básica parece saudável. Se o deploy falha por timeout, tente aumentar COMMAND_DEPLOY_TIMEOUT_MS ou verificar firewall/proxy.');
  } else {
    console.log('⚠️ Problemas detectados:');
    if (!dnsResult.ok) console.log('  - Falha DNS: verifique resolução ou defina DNS custom (ex: 1.1.1.1)');
    if (!tcpResult.ok) console.log('  - Falha TCP: verifique portas bloqueadas / firewall / proxy corporativo');
    if (!httpsResult.ok) console.log('  - Falha HTTPS: possível interceptação TLS ou bloqueio de saída');
  }

  console.log('\nVariáveis úteis:');
  console.log('  COMMAND_DEPLOY_MAX_RETRIES   (default 5)');
  console.log('  COMMAND_DEPLOY_BASE_DELAY_MS  (default 500)');
  console.log('  COMMAND_DEPLOY_JITTER_MS      (default 250)');
  console.log('  COMMAND_DEPLOY_TIMEOUT_MS     (default 10000)');
  console.log('  COMMAND_DEPLOY_DISABLE_RETRY  ("true" para desativar)');

  console.log('\nExecute: npm run deploy (ou deploy:global) após ajustes.');
}

if (require.main === module){
  main().catch(e => {
    console.error('Erro inesperado no diagnóstico:', e);
    process.exit(1);
  });
}

module.exports = { resolveDNS, testTCP, testHTTPS };