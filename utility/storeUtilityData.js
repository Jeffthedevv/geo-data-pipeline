const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

const batchId = process.env.BATCH_ID || 'prelim-0507';

async function storeUtilityData(data) {
  try {
    await client.connect();
    const db = client.db('vvater');
    const collection = db.collection('crawled_zipcodes');

    const result = await collection.updateOne(
      { url: data.url },
      {
        $set: {
          ...data,
          batchId,
        },
      },
      { upsert: true }
    );

    console.log(`💾 Stored utility data for ${data.utilityName} (${data.zip})`);
    return result;
  } catch (err) {
    console.error('❌ Error storing utility data:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeUtilityData;
