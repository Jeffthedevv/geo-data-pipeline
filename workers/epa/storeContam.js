const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function storeEPAData(epaData) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    await collection.insertOne(epaData);

    console.log(`💾 Inserted EPA data from ${epaData.source}`);
  } catch (err) {
    console.error('❌ Error storing EPA data:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeEPAData;
