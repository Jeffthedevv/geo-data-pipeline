const { PlaywrightCrawler } = require('crawlee');
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

        }
      } catch (error) {
        log.error(`🔥 Error processing ${request.url}: ${error.message}`);
      }
    },
    failedRequestHandler({ request, error, log }) {
      log.error(`❌ Failed to process ${request.url}: ${error.message}`);
    },

  });

  await crawler.addRequests([BASE_URL]);
  
  console.log('🕷 Starting crawler...');
  await crawler.run();
  console.log('✅ Crawler finished successfully.');
}

module.exports = startCrawlerStreamed;