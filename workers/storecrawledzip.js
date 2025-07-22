const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

const batchId = process.env.BATCH_ID || 'prelim-0508';

async function storeCrawledZip(zip) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    await collection.updateOne(
      { zip },
      {
        $set: {
          zip,
          crawledAt: new Date(),
          batchId,
        },
      },
      { upsert: true }
    );

    console.log(`✅ Logged crawled ZIP: ${zip}`);
  } catch (err) {
    console.error('❌ Error storing crawled ZIP:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeCrawledZip;
