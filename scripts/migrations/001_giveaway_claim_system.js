/**
 * Migration Script: Giveaway Claim System
 * 
 * Adiciona suporte ao sistema de reclamação de prêmios com 48h
 * 
 * Execução:
 * node scripts/migrations/001_giveaway_claim_system.js
 */

const { mongoose } = require('../../utils/db/mongoose');
const logger = require('../../utils/logger');

async function runMigration() {
  try {
    logger.info('🔄 Iniciando migração: Giveaway Claim System');
    
    // Conectar ao MongoDB
    if (mongoose.connection.readyState !== 1) {
      logger.info('📡 Conectando ao MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
      logger.info('✅ Conectado ao MongoDB');
    }
    
    const db = mongoose.connection.db;
    
    // 1. Criar coleção GiveawayClaim se não existir
    logger.info('📦 Verificando coleção GiveawayClaim...');
    const collections = await db.listCollections({ name: 'giveawayclaims' }).toArray();
    
    if (collections.length === 0) {
      logger.info('➕ Criando coleção GiveawayClaim...');
      await db.createCollection('giveawayclaims');
      logger.info('✅ Coleção GiveawayClaim criada');
    } else {
      logger.info('✅ Coleção GiveawayClaim já existe');
    }
    
    // 2. Criar indexes na coleção GiveawayClaim
    logger.info('📇 Criando indexes...');
    const claimsCollection = db.collection('giveawayclaims');
    
    await claimsCollection.createIndex({ giveaway_id: 1 });
    await claimsCollection.createIndex({ guild_id: 1 });
    await claimsCollection.createIndex({ winner_id: 1 });
    await claimsCollection.createIndex({ user_id: 1 });
    await claimsCollection.createIndex({ ticket_channel_id: 1 });
    await claimsCollection.createIndex({ claim_deadline_at: 1 });
    await claimsCollection.createIndex({ claimed_at: 1 });
    await claimsCollection.createIndex({ status: 1 });
    await claimsCollection.createIndex({ giveaway_id: 1, status: 1 });
    await claimsCollection.createIndex({ guild_id: 1, status: 1 });
    await claimsCollection.createIndex({ claim_deadline_at: 1, status: 1 });
    await claimsCollection.createIndex({ status: 1, processed_by_job: 1 });
    
    logger.info('✅ Indexes criados');
    
    // 3. Atualizar giveaways existentes para adicionar campos de re-roll (se necessário)
    logger.info('🔄 Verificando giveaways existentes...');
    const giveawaysCollection = db.collection('giveaways');
    
    const giveawaysCount = await giveawaysCollection.countDocuments();
    logger.info(`📊 Encontrados ${giveawaysCount} giveaways existentes`);
    
    if (giveawaysCount > 0) {
      // Adicionar campo options.allow_reroll se não existir (default: true)
      const updateResult = await giveawaysCollection.updateMany(
        { 'options.allow_reroll': { $exists: false } },
        { $set: { 'options.allow_reroll': true } }
      );
      
      logger.info(`✅ Atualizado ${updateResult.modifiedCount} giveaways com allow_reroll`);
    }
    
    // 4. Verificar integridade dos dados
    logger.info('🔍 Verificando integridade...');
    
    const claimsCount = await claimsCollection.countDocuments();
    logger.info(`📊 ${claimsCount} claims registrados`);
    
    const pendingClaimsCount = await claimsCollection.countDocuments({ status: 'pending' });
    logger.info(`⏳ ${pendingClaimsCount} claims pendentes`);
    
    const expiredClaimsCount = await claimsCollection.countDocuments({ 
      status: 'pending',
      claim_deadline_at: { $lt: new Date() }
    });
    logger.info(`⚠️ ${expiredClaimsCount} claims expirados (serão processados pelo job)`);
    
    // 5. Estatísticas finais
    logger.info('');
    logger.info('📊 Estatísticas da Migração:');
    logger.info(`   - Giveaways totais: ${giveawaysCount}`);
    logger.info(`   - Claims totais: ${claimsCount}`);
    logger.info(`   - Claims pendentes: ${pendingClaimsCount}`);
    logger.info(`   - Claims expirados: ${expiredClaimsCount}`);
    logger.info('');
    logger.info('✅ Migração concluída com sucesso!');
    logger.info('');
    logger.info('ℹ️ Próximos passos:');
    logger.info('   1. Reiniciar o bot para ativar o job processor');
    logger.info('   2. Verificar logs para garantir que o job está executando');
    logger.info('   3. Testar criação de novo giveaway com sistema de claim');
    logger.info('');
    
  } catch (error) {
    logger.error('❌ Erro durante migração:', error);
    throw error;
  } finally {
    // Fechar conexão
    await mongoose.connection.close();
    logger.info('👋 Conexão fechada');
  }
}

// Executar migração
if (require.main === module) {
  runMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
