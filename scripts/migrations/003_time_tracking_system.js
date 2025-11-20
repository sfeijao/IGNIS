/**
 * Migration: Time Tracking System
 *
 * Creates timetrackingsessions collection and indexes
 * No data migration needed - new feature
 */

const mongoose = require('mongoose');
const { logger } = require('../../utils/logger');

async function migrate() {
  try {
    logger.info('🔄 Starting Time Tracking System migration...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not defined in environment');
    }

    await mongoose.connect(mongoUri);
    logger.info('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check if collection exists
    const collections = await db.listCollections({ name: 'timetrackingsessions' }).toArray();

    if (collections.length === 0) {
      logger.info('📦 Creating timetrackingsessions collection...');
      await db.createCollection('timetrackingsessions');
      logger.info('✅ Collection created');
    } else {
      logger.info('ℹ️  Collection timetrackingsessions already exists');
    }

    // Create indexes
    logger.info('🔧 Creating indexes...');

    const collection = db.collection('timetrackingsessions');

    // Single field indexes
    await collection.createIndex({ guild_id: 1 });
    logger.info('  ✅ guild_id');

    await collection.createIndex({ user_id: 1 });
    logger.info('  ✅ user_id');

    await collection.createIndex({ status: 1 });
    logger.info('  ✅ status');

    // Compound indexes (order matters for query optimization)
    await collection.createIndex({ guild_id: 1, user_id: 1 });
    logger.info('  ✅ guild_id + user_id');

    await collection.createIndex({ guild_id: 1, status: 1 });
    logger.info('  ✅ guild_id + status');

    await collection.createIndex({ guild_id: 1, user_id: 1, status: 1 });
    logger.info('  ✅ guild_id + user_id + status');

    await collection.createIndex({ guild_id: 1, started_at: -1 });
    logger.info('  ✅ guild_id + started_at (desc)');

    await collection.createIndex({ user_id: 1, started_at: -1 });
    logger.info('  ✅ user_id + started_at (desc)');

    // Statistics
    const totalSessions = await collection.countDocuments();
    const activeSessions = await collection.countDocuments({ status: 'active' });
    const pausedSessions = await collection.countDocuments({ status: 'paused' });
    const endedSessions = await collection.countDocuments({ status: 'ended' });

    logger.info('\n📊 Migration Statistics:');
    logger.info(`  Total sessions: ${totalSessions}`);
    logger.info(`  Active: ${activeSessions}`);
    logger.info(`  Paused: ${pausedSessions}`);
    logger.info(`  Ended: ${endedSessions}`);

    logger.info('\n✅ Migration completed successfully!');
    logger.info('\n📝 Next steps:');
    logger.info('  1. Restart bot to load new command');
    logger.info('  2. Users can run /bate-ponto iniciar');
    logger.info('  3. Use ephemeral buttons: Pausar, Retomar, Terminar');
    logger.info('  4. View history: /bate-ponto historico');
    logger.info('  5. Admins can see reports in dashboard');
    logger.info('  6. All interactions are private (ephemeral)');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
