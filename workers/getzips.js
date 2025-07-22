const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function getZipcodesFromDB(limit, startZip) {
  await client.connect();
  const db = client.db('');

  // Helper to extract ZIPs from a collection
  const extractZips = async (collectionName) => {
    const docs = await db.collection(collectionName).find({}, { projection: { zip: 1, _id: 0 } }).toArray();
    return new Set(docs.map(doc => doc.zip));
  };

  const [crawledZips, skippedZips] = await Promise.all([
    extractZips('crawled_zipcodes'),
    extractZips('skipped_zipcodes'),
  ]);

  const processedZips = new Set([...crawledZips, ...skippedZips]);

  const filter = {
    zip: {
      $nin: [...processedZips],
      ...(startZip ? { $gte: startZip } : {})
    }
  };

  let query = db.collection('uszipcodes').find(filter, { projection: { zip: 1, _id: 0 } });

  if (Number.isInteger(limit)) {
    query = query.limit(limit);
  }

  const zipcodes = await query.toArray();
  return zipcodes.map(doc => doc.zip);
}

module.exports = getZipcodesFromDB;
