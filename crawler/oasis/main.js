const { PlaywrightCrawler } = require('crawlee');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const BASE_URL = 'https://www.oasishealth.app/top-rated/bottled_water';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'geo_data_pipeline';
const COLLECTION_NAME = 'oasis_water_product_urls';
const FAILED_COLLECTION = 'oasis_water_product_failures';

async function startOasisAutoscrollCrawler() {
console.log("🚀 Starting Oasis Crawler with resume logic...");

const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db(DB_NAME);
const collection = db.collection(COLLECTION_NAME);
const failedCollection = db.collection(FAILED_COLLECTION);

const crawler = new PlaywrightCrawler({
  headless: false,
  maxConcurrency: 1,
  requestHandlerTimeoutSecs: 18000,

async requestHandler({ page }) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('div.bg-card.border.rounded-2xl', { timeout: 20000 });

  const seenNames = new Set();
  const allNames = [];
  while (true) {
    const previousHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1800);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);

    const newCards = await page.$$eval('div.bg-card.border.rounded-2xl', cards =>
      cards.map(card => {
        const nameEl = card.querySelector('div.text-lg.line-clamp-2');
        return nameEl?.innerText?.trim() || null;
      })
    );

    newCards.forEach(name => {
      if (name && !seenNames.has(name)) {
        seenNames.add(name);
        allNames.push(name);
      }
    });

    if (newHeight === previousHeight) break;
  }

  console.log(`✅ Loaded ${allNames.length} product names.`);

  const storedNames = await collection.find({}).project({ name: 1 }).toArray();
  const storedSet = new Set(storedNames.map(doc => doc.name));
  const startIndex = allNames.findIndex(name => !storedSet.has(name));

  if (startIndex === -1) {
    console.log('🎉 All products already stored! Nothing to do.');
    return;
  }

  console.log(`🔁 Resuming crawl from index ${startIndex}: ${allNames[startIndex]}`);

  for (let i = startIndex; i < allNames.length; i++) {
    const name = allNames[i];
    console.log(`🕵️ Searching for card: ${name}`);

    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let j = 0; j < 35; j++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await sleep(500);
      }

      const matchHandle = await page.evaluateHandle((targetName) => {
        const cards = Array.from(document.querySelectorAll('div.bg-card.border.rounded-2xl'));
        return cards.find(card => {
          const title = card.querySelector('div.text-lg.line-clamp-2');
          return title && title.innerText.trim() === targetName;
        }) || null;
      }, name);

      if (!matchHandle || !(await matchHandle.jsonValue())) {
        console.warn(`⚠️ Card not found: ${name}`);
        await failedCollection.updateOne(
          { name },
          { $set: { name, reason: 'Card not found after scroll', timestamp: new Date() } },
          { upsert: true }
        );
        continue;
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
        matchHandle.asElement().click()
      ]);

      const currentUrl = page.url();
      const image = await page.$eval('img', el => el.src);

      await collection.updateOne(
        { name },
        { $set: { name, url: currentUrl, image } },
        { upsert: true }
      );

      console.log(`💾 Stored: ${name} → ${currentUrl}`);

      await page.goBack({ waitUntil: 'networkidle' });
      await sleep(3000);
    } catch (err) {
      console.warn(`⚠️ Failed to navigate for ${name}: ${err.message}`);
      await failedCollection.updateOne(
        { name },
        { $set: { name, reason: err.message, timestamp: new Date() } },
        { upsert: true }
      );
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await sleep(3000);
    }
  }
}
});

await crawler.addRequests([{ url: BASE_URL }]);
await crawler.run();
await client.close();

console.log('🏁 Oasis crawl and match complete.');
}

module.exports = startOasisAutoscrollCrawler;

