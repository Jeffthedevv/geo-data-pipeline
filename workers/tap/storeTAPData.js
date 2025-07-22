const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function storeTAPData(utilityData) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    // Use utility name from nested pwsInfo object
    const utilityName = utilityData.pwsInfo?.contactOrg || 'Unknown Utility';

    await collection.updateOne(
      { zip: utilityData.zip, utilityName },
      { $set: { ...utilityData, utilityName } },
      { upsert: true }
    );

    console.log(`💾 Stored utility data for ${utilityName} (${utilityData.zip})`);
  } catch (err) {
    console.error('❌ Error storing utility data:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeTAPData;
