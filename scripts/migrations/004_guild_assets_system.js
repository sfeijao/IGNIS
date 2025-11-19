/**
 * Migration: Guild Assets System
 * Creates collection and indexes for custom avatars/banners
 * Run: node scripts/migrations/004_guild_assets_system.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;

  // Create collection
  console.log('\n📦 Creating guildassetconfigs collection...');
  const collections = await db.listCollections({ name: 'guildassetconfigs' }).toArray();
  
  if (collections.length === 0) {
    await db.createCollection('guildassetconfigs');
    console.log('✅ Collection created');
  } else {
    console.log('ℹ️  Collection already exists');
  }

  // Create indexes
  console.log('\n🔧 Creating indexes...');
  
  const indexSpecs = [
    { keys: { guild_id: 1 }, options: { unique: true, name: 'guild_id_unique' } },
    { keys: { created_at: 1 }, options: { name: 'created_at_index' } },
    { keys: { updated_at: 1 }, options: { name: 'updated_at_index' } },
    { keys: { 'webhook_configs.webhook_id': 1 }, options: { name: 'webhook_id_index', sparse: true } }
  ];

  for (const spec of indexSpecs) {
    try {
      await db.collection('guildassetconfigs').createIndex(spec.keys, spec.options);
      console.log(`✅ Index created: ${spec.options.name}`);
    } catch (err) {
      if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
        console.log(`ℹ️  Index already exists: ${spec.options.name}`);
      } else {
        throw err;
      }
    }
  }

  // Show statistics
  console.log('\n📊 Collection Statistics:');
  const stats = await db.collection('guildassetconfigs').stats();
  console.log(`  - Total documents: ${stats.count}`);
  console.log(`  - Storage size: ${(stats.storageSize / 1024).toFixed(2)} KB`);
  console.log(`  - Indexes: ${stats.nindexes}`);
  
  const indexes = await db.collection('guildassetconfigs').indexes();
  console.log('\n📑 Indexes:');
  indexes.forEach(index => {
    console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
  });

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Navigate to Dashboard → Server Settings → Avatar & Banner');
  console.log('  2. Upload custom avatar (max 10MB)');
  console.log('  3. Upload custom banner (max 10MB)');
  console.log('  4. Configure webhooks in specific channels to use custom avatar');
  console.log('  5. Test webhook messages to see custom avatar in action');

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
