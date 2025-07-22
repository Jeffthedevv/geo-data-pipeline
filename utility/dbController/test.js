// utils/testCosmosConnection.js
const { MongoClient } = require("mongodb");

/**
 * Tests connectivity to a Cosmos DB MongoDB API instance.
 * 
 * @param {string} cosmosUri - Full connection string (including credentials)
 * @param {string} dbName - Name of the database to connect to
 * @returns {Promise<boolean>}
 */
async function testCosmosConnection(cosmosUri, dbName) {
  const client = new MongoClient(cosmosUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Optional timeout
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(`✅ Connected to Cosmos DB. Found ${collections.length} collections.`);
    return true;
  } catch (err) {
    console.error("❌ Failed to connect to Cosmos DB:", err.message);
    return false;
  } finally {
    await client.close();
  }
}

module.exports = { testCosmosConnection };