const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function importZipcodes(csvPath = './sheets/uszips.csv') {
  const zipData = [];

  console.log('⏳ Starting ZIP code import...');
  console.log(`📄 Reading file: ${csvPath}`);

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        zipData.push({
          zip: row.zip,
          lat: isNaN(parseFloat(row.lat)) ? null : parseFloat(row.lat),
          lng: isNaN(parseFloat(row.lng)) ? null : parseFloat(row.lng),
          city: row.city,
          state_id: row.state_id,
          state_name: row.state_name,
          zcta: row.zcta === 'TRUE',
          parent_zcta: row.parent_zcta || null,
          population: parseInt(row.population, 10) || 0,
          density: parseFloat(row.density) || 0,
          county_fips: row.county_fips,
          county_name: row.county_name,
          county_weights: row.county_weights,
          county_names_all: row.county_names_all,
          county_fips_all: row.county_fips_all,
          imprecise: row.imprecise === 'TRUE',
          military: row.military === 'TRUE',
          timezone: row.timezone,
        });
      })
      .on('end', async () => {
        const client = new MongoClient(uri);
        try {
          console.log(`✅ Finished reading. ${zipData.length} records parsed.`);
          console.log('🔌 Connecting to MongoDB...');
          await client.connect();
          const db = client.db('vvater');
          const collection = db.collection('uszipcodes');

          console.log('🧹 Clearing old ZIP data...');
          await collection.deleteMany({});

          console.log('📥 Inserting new ZIP data...');
          await collection.insertMany(zipData);
          console.log(`✅ Inserted ${zipData.length} records into MongoDB.`);
          resolve();
        } catch (err) {
          console.error('❌ Mongo insert error:', err);
          reject(err);
        } finally {
          await client.close();
          console.log('🔒 MongoDB connection closed.');
        }
      })
      .on('error', (err) => {
        console.error('❌ File read error:', err);
        reject(err);
      });
  });
}

module.exports = importZipcodes;
