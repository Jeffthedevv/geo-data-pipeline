const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function isZipSkipped(zip) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    const result = await collection.findOne({ zip });
    return !!result;
  } catch (err) {
    console.error('❌ Error checking skipped ZIP:', err);
    return false;
  } finally {
    await client.close();
  }
}

module.exports = isZipSkipped;
