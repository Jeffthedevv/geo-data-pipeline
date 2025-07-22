const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function storeEPAData(data) {
  try {
    await client.connect();
    const db = client.db('');

    // ✅ Store everything in the same collection
    const collection = db.collection('');

    await collection.insertOne(data);

    const label = data.category || data.type || 'unnamed';
    console.log(`💾 Inserted "${label}" into epa_contaminants`);
  } catch (err) {
    console.error('❌ Error storing EPA data:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeEPAData;
