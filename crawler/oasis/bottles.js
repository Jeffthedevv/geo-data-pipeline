require('dotenv').config();

const { PlaywrightCrawler } = require('crawlee');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'geo_data_pipeline';
const SOURCE_COLLECTION = '';
const OUTPUT_COLLECTION = '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function crawlOasisProductPages() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const inputCollection = db.collection(SOURCE_COLLECTION);
        const outputCollection = db.collection(OUTPUT_COLLECTION);

        const productDocs = await inputCollection.find({}).toArray();
        const urlsToCrawl = productDocs.map(doc => ({ url: doc.url }));

        const crawler = new PlaywrightCrawler({
            headless: false,
            maxConcurrency: 2,
            requestHandlerTimeoutSecs: 120,
            async requestHandler({ request, page, log }) {
                try {
                    await page.goto(request.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000,
                    });
                    // 🔎 Setup console log listener for itemMetadata
                    let loggedMetadata = null;
                    page.on('console', async (msg) => {
                        try {
                            const text = msg.text();
                            if (text.startsWith('itemMetadata')) {
                                const jsonMatch = text.match(/\{[\s\S]*\}$/);
                                if (jsonMatch) {
                                    loggedMetadata = JSON.parse(jsonMatch[0]);
                                    log.info('📦 Captured console itemMetadata');
                                }
                            }
                        } catch (err) {
                            log.warning('⚠️ Failed to parse console message:', msg.text());
                        }
                    });

                    // ⏳ Wait for relevant sections or cards
                    await Promise.all([
                        page.locator('h3:has-text("Contaminants")').waitFor({ timeout: 10000 }).catch(() => null),
                        page.locator('h3:has-text("Ingredients & Minerals")').waitFor({ timeout: 10000 }).catch(() => null),
                        page.locator('div.rounded-md.border').first().waitFor({ timeout: 10000 }).catch(() => null),
                    ]);

                    await page.waitForTimeout(1000);

                    // 🐞 Debug: log h3 headers on the page
                    const debugHeaders = await page.locator('h3').allTextContents().catch(() => []);
                    log.info(`🔍 Found headers: ${JSON.stringify(debugHeaders)}`);

                    const title = await page.title();

                    const getText = async (selector) => {
                        try {
                            return await page.locator(selector).innerText();
                        } catch {
                            return null;
                        }
                    };

                    const extractCardSection = async (sectionTitle) => {
                        try {
                            const sectionHeader = page.locator(`h3:has-text("${sectionTitle}")`).first();
                            if (await sectionHeader.count() === 0) return {};

                            const section = sectionHeader.locator('xpath=ancestor::section').first();
                            const cards = section.locator('div.rounded-md.border');

                            const count = await cards.count();
                            const results = {};

                            for (let i = 0; i < count; i++) {
                                const card = cards.nth(i);
                                const name = await card.locator('p.text-primary').textContent().catch(() => null);
                                const level = await card.locator('p.text-muted, .text-muted-foreground').textContent().catch(() => null);
                                const risks = await card.locator('p.text-red-500').textContent().catch(() => null);

                                if (name) {
                                    results[name.trim()] = {
                                        level: level?.trim() || null,
                                        risks: risks?.trim() || null,
                                    };
                                }
                            }

                            return results;
                        } catch (err) {
                            log.error(`❌ Error extracting ${sectionTitle}: ${err.message}`);
                            return {};
                        }
                    };

                    const rawLabTested = await getText('text=Lab tested');
                    const labTested = rawLabTested ? 'tested' : 'not tested';

                    const data = {
                        title,
                        url: request.url,
                        labTested,
                        harmfulIngredients: await getText('text=Harmful Ingredients'),
                        nutrients: await getText('text=Nutrients'),
                        microplastics: await getText('text=Microplastics'),
                        contaminants: await extractCardSection('Contaminants'),
                        ingredientsAndMinerals: await extractCardSection('Ingredients & Minerals'),
                        crawledAt: new Date(),
                    };

                    // 🧠 Add console metadata if captured
                    if (loggedMetadata) {
                        data.consoleMetadata = loggedMetadata;
                    }

                    await outputCollection.insertOne(data);
                    log.info(`✅ Saved: ${title}`);
                    await sleep(3000);
                } catch (err) {
                    log.error(`❌ Error on ${request.url}: ${err.stack || err.message}`);
                }
            },
        });

        await crawler.run(urlsToCrawl);
    } catch (err) {
        console.error('❌ Failed to initialize crawler:', err);
    } finally {
        await client.close();
    }
}

module.exports = { crawlOasisProductPages };
