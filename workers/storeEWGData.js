const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function storeEWGData(utilityData) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    await collection.updateOne(
      { zip: utilityData.zip, utilityName: utilityData.utilityName },
      { $set: utilityData },
      { upsert: true }
    );

    console.log(`💾 Stored utility data for ${utilityData.utilityName} (${utilityData.zip})`);
  } catch (err) {
    console.error('❌ Error storing utility data:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeEWGData;
