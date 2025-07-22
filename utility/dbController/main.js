const { MongoClient } = require("mongodb");

/**
 * Migrates documents from a local MongoDB collection to Azure Cosmos DB (Mongo API).
 * Now includes a check to confirm local data exists before migration starts.
 *
 * @param {Object} options
 * @param {string} options.localUri - URI to local MongoDB
 * @param {string} options.cosmosUri - URI to Cosmos DB (Mongo API)
 * @param {string} options.dbName - Database name (shared between both sources)
 * @param {string} options.collectionName - Local collection name
 * @param {string} [options.targetCollectionName] - Optional different Cosmos collection name
 * @param {number} [options.batchSize=1000] - Number of docs per insert batch
 * @param {Object} [options.filter={}] - Optional filter for documents to migrate
 * @param {function} [options.transform=null] - Optional transform function for each doc
 * @returns {Promise<{ success: boolean, inserted?: number, error?: string }>}
 */


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateCollection({
  localUri = "mongodb://localhost:27017",
  cosmosUri,
  dbName,
  collectionName,
  targetCollectionName = null,
  batchSize = 1000,
  filter = {},
  transform = null,
  startAt = 1,
}) {
  const localClient = new MongoClient(localUri);
  const cosmosClient = new MongoClient(cosmosUri);

  try {
    await localClient.connect();
    console.log("✅ Connected to local MongoDB");

    const localDb = localClient.db(dbName);
    const localColl = localDb.collection(collectionName);

    // ✅ Count local documents before proceeding
    const localCount = await localColl.countDocuments(filter);
    console.log(`📊 Local collection "${collectionName}" has ${localCount} document(s).`);

    if (localCount === 0) {
      console.warn("⚠️ No documents to migrate. Aborting.");
      return { success: false, error: "Local collection is empty" };
    }

    await cosmosClient.connect();
    console.log("✅ Connected to Cosmos DB");

    const cosmosDb = cosmosClient.db(dbName);
    const cosmosColl = cosmosDb.collection(targetCollectionName || collectionName);

    const cursor = localColl.find(filter).skip(startAt);
    let batch = [];
    let totalInserted = 0;
    let totalSeen = 0;

    while (await cursor.hasNext()) {
      let doc = await cursor.next();
      totalSeen++;

      if (transform) doc = transform(doc);
      batch.push(doc);

      if (batch.length === batchSize) {
        const result = await cosmosColl.insertMany(batch);
        totalInserted += result.insertedCount;
        console.log(`📦 Inserted ${result.insertedCount} documents (total so far: ${totalInserted})`);
        batch = [];

        await sleep(1000);
      }
    }

    if (batch.length) {
      const result = await cosmosColl.insertMany(batch);
      totalInserted += result.insertedCount;
      console.log(`📦 Inserted final batch of ${result.insertedCount}. Total inserted: ${totalInserted}`);
    }

    console.log(`✅ Migration complete: ${collectionName} ➡️ ${targetCollectionName || collectionName}`);
    return { success: true, inserted: totalInserted };
  } catch (err) {
    console.error(`❌ Migration failed:`, err.message);
    return { success: false, error: err.message };
  } finally {
    await localClient.close();
    await cosmosClient.close();
  }
}

module.exports = { migrateCollection };
