// crawler/oasis/storeOasisProduct.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function storeOasisProduct(product) {
  try {
    await client.connect();
    const db = client.db('');
    const collection = db.collection('');

    await collection.insertOne(product);
    console.log(`💾 Stored product: ${product.name || 'Unnamed'} (${product.url})`);
  } catch (err) {
    console.error('❌ MongoDB store error:', err.message);
  } finally {
    await client.close();
  }
}

module.exports = storeOasisProduct;
