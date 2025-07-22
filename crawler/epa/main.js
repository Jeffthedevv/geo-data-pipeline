const { PlaywrightCrawler } = require('crawlee');
const storeEPAData = require('../../workers/epa/storeEPAREGData.js'); // Adjust path as needed
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE_URL = 'https://www.epa.gov/ground-water-and-drinking-water/national-primary-drinking-water-regulations';

async function startCrawlerStreamed() {
  console.log('🚀 Preparing to stream and crawl...');

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxConcurrency: 2,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 45,
    maxRequestRetries: 2,

    async requestHandler({ request, page, log }) {
      try {
        const response = await page.goto(request.url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        if (!response) {
          log.error(`❌ page.goto() returned null for ${request.url}`);
          return;
        }

        if (response.status() === 429) {
          log.warning(`🛑 429 received at ${request.url}. Retrying after delay.`);
          await sleep(3000);
          throw new Error('Retrying after 429');
        }

        if (request.url.includes('ground-water-and-drinking-water/national-primary-drinking-water-regulations')) {
          log.info(`🔍 Crawling page: ${request.url}`);

          const tablesData = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table.tablebord.zebra'));
            return tables.map((table) => {
              const category = table.querySelector('caption h3')?.innerText.trim() || 'Unknown Category';
              const rows = Array.from(table.querySelectorAll('tbody tr'));
              const data = rows.map((row) => {
                const cells = row.querySelectorAll('td');
                return {
                  contaminant: cells[0]?.innerText.trim(),
                  mclg: cells[1]?.innerText.trim(),
                  mcl_or_tt: cells[2]?.innerText.trim(),
                  health_effects: cells[3]?.innerText.trim(),
                  sources: cells[4]?.innerText.trim(),
                };
              });
              return { category, data };
            });
          });

          const notesData = await page.evaluate(() => {
            const heading = document.querySelector('h2')?.innerText.trim();
            const paragraphs = Array.from(
              document.querySelectorAll('h2 + p, h2 + ul, h2 + ol, h2 ~ p, h2 ~ ul, h2 ~ ol')
            );
            const notes = [];

            paragraphs.forEach((el) => {
              if (el.tagName === 'P') {
                notes.push({ type: 'paragraph', content: el.innerText.trim() });
              } else if (el.tagName === 'UL') {
                const items = Array.from(el.querySelectorAll('li')).map((li) => li.innerText.trim());
                notes.push({ type: 'ul', items });
              } else if (el.tagName === 'OL') {
                const items = Array.from(el.querySelectorAll('li')).map((li) => li.innerText.trim());
                notes.push({ type: 'ol', items });
              }
            });

            return { heading, notes };        
          });

          // Store each table individually
          for (const table of tablesData) {
            const tableDocument = {
              source: request.url,
              category: table.category,
              extractedAt: new Date(),
              data: table.data,
            };

            await storeEPAData(tableDocument);
            log.info(`✅ Stored table for category: ${table.category}`);
          }

          // Store notes as a separate entry
          const notesDocument = {
            source: request.url,
            extractedAt: new Date(),
            type: 'notes',
            notes: notesData,
          };

          await storeEPAData(notesDocument);
          log.info('✅ Stored notes section.');
        }
      } catch (err) {
        log.error(`❌ Error loading page ${request.url}: ${err.message}`);
      }
    },

    failedRequestHandler({ request, error }) {
      console.error(`❌ Request failed: ${request.url}\nReason: ${error.message}`);
    },
  });

  await crawler.addRequests([BASE_URL]);

  console.log('🕷 Starting crawler...');
  await crawler.run();
  console.log('✅ Crawler finished successfully.');
}

module.exports = startCrawlerStreamed;
