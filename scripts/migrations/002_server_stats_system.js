/**
 * Migration: Server Stats System
 * 
 * Creates serverstatsconfigs collection and indexes
 * No data migration needed - new feature
 */

const mongoose = require('mongoose');
const { logger } = require('../../utils/logger');

async function migrate() {
  try {
    logger.info('🔄 Starting Server Stats System migration...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not defined in environment');
    }

    await mongoose.connect(mongoUri);
    logger.info('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check if collection exists
    const collections = await db.listCollections({ name: 'serverstatsconfigs' }).toArray();
    
    if (collections.length === 0) {
      logger.info('📦 Creating serverstatsconfigs collection...');
      await db.createCollection('serverstatsconfigs');
      logger.info('✅ Collection created');
    } else {
      logger.info('ℹ️  Collection serverstatsconfigs already exists');
    }

    // Create indexes
    logger.info('🔧 Creating indexes...');
    
    const collection = db.collection('serverstatsconfigs');
    
    await collection.createIndex({ guild_id: 1 }, { unique: true });
    logger.info('  ✅ guild_id (unique)');

    await collection.createIndex({ enabled: 1 });
    logger.info('  ✅ enabled');

    await collection.createIndex({ last_update_at: 1 });
    logger.info('  ✅ last_update_at');

    await collection.createIndex({ enabled: 1, last_update_at: 1 });
    logger.info('  ✅ enabled + last_update_at (compound)');

    // Statistics
    const totalConfigs = await collection.countDocuments();
    const enabledConfigs = await collection.countDocuments({ enabled: true });

    logger.info('\n📊 Migration Statistics:');
    logger.info(`  Total configurations: ${totalConfigs}`);
    logger.info(`  Enabled configurations: ${enabledConfigs}`);

    logger.info('\n✅ Migration completed successfully!');
    logger.info('\n📝 Next steps:');
    logger.info('  1. Restart bot to initialize ServerStatsProcessor');
    logger.info('  2. Access dashboard → Server Stats page');
    logger.info('  3. Select metrics and click "Setup Server Stats"');
    logger.info('  4. Bot will create voice channels automatically');
    logger.info('  5. Channels update every X minutes (configurable)');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
