const { PlaywrightCrawler } = require('crawlee');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const BASE_URL = 'https://www.oasishealth.app/top-rated/bottled_water';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'geo_data_pipeline';
const COLLECTION_NAME = 'oasis_water_product_urls';
const FAILED_COLLECTION = 'oasis_water_product_failures';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryFailedOasisProducts() {
  const normalizeName = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  console.log('🚀 Starting Retry Crawler for Oasis...');

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✅ MongoDB connected successfully.');
  const db = client.db(DB_NAME);
  const productCollection = db.collection(COLLECTION_NAME);
  const failedCollection = db.collection(FAILED_COLLECTION);

  const failedDocs = await failedCollection.find({}).toArray();
  const retryNames = failedDocs.map((doc) => doc.name);

  const crawler = new PlaywrightCrawler({
    headless: false,
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 18000,

    async requestHandler({ page }) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await sleep(2000);

      const scrollToBottom = async () => {
        let previousHeight;
        while (true) {
          previousHeight = await page.evaluate('document.body.scrollHeight');
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await sleep(2000);
          const newHeight = await page.evaluate('document.body.scrollHeight');
          if (newHeight === previousHeight) break;
        }
      };

      for (const originalName of retryNames) {
        const normalizedTarget = normalizeName(originalName);
        console.log(`🔁 Retrying: ${originalName}`);
        let found = false;

        await scrollToBottom();
        const cards = await page.$$('div.bg-card.border.rounded-2xl');

        for (const card of cards) {
          const titleHandle = await card.$('div.text-lg.line-clamp-2');
          const cardTitle = titleHandle ? await titleHandle.innerText() : null;
          const normalizedCardTitle = normalizeName(cardTitle || '');

          if (normalizedCardTitle === normalizedTarget) {
            try {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle', timeout: 12000 }),
                card.click()
              ]);

              const url = page.url();
              const imageHandle = await page.$('img');
              const image = imageHandle ? await imageHandle.getAttribute('src') : null;

              console.log(`✅ Recovered: ${originalName} → ${url}`);

              await productCollection.updateOne(
                { name: originalName },
                { $set: { name: originalName, url, image } },
                { upsert: true }
              );

              await failedCollection.deleteOne({ name: originalName });

              await page.goBack({ waitUntil: 'networkidle' });
              await sleep(2000);
              found = true;
              break;
            } catch (err) {
              console.warn(`⚠️ Retry failed for ${originalName}: ${err.message}`);
              break;
            }
          }
        }

        if (!found) {
          console.warn(`⚠️ Card not found for: ${originalName}`);
        }
      }
    }
  });

  await crawler.addRequests([{ url: BASE_URL }]);
  await crawler.run();
  await client.close();
  console.log('🏁 Retry crawl complete.');
}

module.exports = retryFailedOasisProducts;
