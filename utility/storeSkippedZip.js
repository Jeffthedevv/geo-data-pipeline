const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

const batchId = process.env.BATCH_ID || 'prelim-0507';

async function storeSkippedZip(zip, reason = 'Unknown') {
  try {
    await client.connect();
    const db = client.db('vvater');
    const collection = db.collection('skipped_zipcodes');

    await collection.updateOne(
      { zip },
      {
        $set: {
          zip,
          reason,
          skippedAt: new Date(),
          batchId,
        }
      },
      { upsert: true }
    );

    console.log(`⏭️ Logged skipped ZIP: ${zip} (${reason})`);
  } catch (err) {
    console.error('❌ Error storing skipped ZIP:', err);
  } finally {
    await client.close();
  }
}

module.exports = storeSkippedZip;
