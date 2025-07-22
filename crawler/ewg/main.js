const { PlaywrightCrawler } = require('crawlee');
const storeSkippedZip = require('../../utility/storeSkippedZip.js');
const storeUtilityData = require('../../utility/storeUtilityData.js');
const storeEWGData = require('../../workers/storeEWGData.js');
const storeCrawledZip = require('../../workers/storecrawledzip.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const BASE_URL = 'https://www.ewg.org/tapwater/';
const SEARCH_URL_START = 'search-results.php?zip5=';
const SEARCH_URL_END = '&searchtype=zip';

async function ewgcrawler(zipcodes) {
  console.log('🚀 Preparing to stream and crawl...');

  const urlsToCrawl = zipcodes.map((zip, index) => ({
    url: `${BASE_URL}${SEARCH_URL_START}${zip}${SEARCH_URL_END}`,
    userData: {
      zip,
      rowIndex: index,
    },
  }));

  console.log(`📄 Queued ${urlsToCrawl.length} URLs for crawling...`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxConcurrency: 2,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 45,
    maxRequestRetries: 2,

    async requestHandler({ request, page, enqueueLinks, log }) {
      const url = request.url;
      const delay = 1000 + Math.floor(Math.random() * 1500);
      await sleep(delay);

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        if (response.status() === 429) {
          log.warning(`🛑 429 received at ${url}. Retrying after delay.`);
          await sleep(3000);
          throw new Error('Retrying after 429');
        }

        // === ZIP-level page ===
        if (url.includes('tapwater/search-results.php?zip5=')) {
          const zip = request.userData.zip;
          log.info(`🔍 Scanning utilities for ZIP ${zip}`);

          const hasTable = await page.$('.featured-utility-table');
          if (!hasTable) {
            log.info(`⚠️ No utilities found (no table) for ZIP ${zip}`);
            await storeSkippedZip(zip, 'No utility table found');
            return;
          }

          const utilityLinks = await page.$$eval(
            '.featured-utility-table a.featured-utility-link',
            (els) => els.map((el) => el.getAttribute('href'))
          );

          const fullLinks = utilityLinks.map((relative) => new URL(relative, BASE_URL).href);
          log.info(`📌 Found ${fullLinks.length} utilities in ZIP ${zip}`);

          for (const link of fullLinks) {
            await enqueueLinks({
              urls: [link],
              userData: { sourceZip: zip }
            });
            log.info(`🔗 Enqueued utility link: ${link}`);
          }
        }

        // === Utility detail page ===
        else if (url.includes('/tapwater/system.php?pws=')) {
          const sourceZip = request.userData.sourceZip;
          log.info(`📄 Crawling utility page: ${url} (from ZIP ${sourceZip})`);

          const utilityName = await page.$eval('section.detail-page-hero-content h1', el => el.textContent.trim());
          const location = await page.$eval('section.details-hero-sub-content:nth-child(1) h2', el => el.textContent.trim());
          const serves = await page.$eval('section.details-hero-sub-content:nth-child(2) h2', el => el.textContent.trim());
          const source = await page.$eval('section.details-hero-sub-content:nth-child(3) h2', el => el.textContent.trim());
          const dataRange = await page.$eval('section.details-hero-sub-content:nth-child(4) h2', el => el.textContent.trim());

          const contaminants = await page.$$eval('.contaminants-grid .contaminant-data', contaminantEls => {
            return contaminantEls.map(contam => {
              const name = contam.querySelector('h3')?.textContent.trim();
              const potentialEffect = contam.querySelector('.potentital-effect')?.textContent.replace('Potential Effect:', '').trim();
              const thisUtilityAmount = contam.querySelector('.this-utility-text')?.textContent.replace('This Utility:', '').trim();
              const legalLimit = contam.querySelector('.legal-limit-text')?.textContent.replace('Legal Limit:', '').trim();
              const timesAbove = contam.querySelector('.detect-times-greater-than')?.textContent.trim();
              const healthGuideline = contam.querySelector('.health-guideline-text')?.textContent.replace("EWG's Health Guideline:", '').trim();
              return {
                name,
                potentialEffect,
                thisUtilityAmount,
                legalLimit,
                timesAbove,
                healthGuideline,
              };
            });
          });

          const utilityData = {
            zip: sourceZip,
            url,
            utilityName,
            location,
            serves,
            source,
            dataRange,
            contaminants,
            crawledAt: new Date(),
          };
          
          await storeUtilityData(utilityData);
          console.log('📦 Full Utility Data:', utilityData);

          await storeEWGData(utilityData);
          console.log(`💾 Stored utility data for ${utilityName} (${sourceZip})`);

          await storeCrawledZip(sourceZip);
          console.log(`✅ Stored utility data for ${utilityName}`);

        } else {
          log.warning(`⚠️ Skipping unknown page format: ${url}`);
        }

      } catch (err) {
        log.error(`❌ Error processing ${url}: ${err.message}`);
        throw err;
      }
    },

    failedRequestHandler({ request, error }) {
      console.error(`❌ Request failed: ${request.url}\nReason: ${error.message}`);
    },
  });



  console.log('🕷 Starting crawler...');
  await crawler.run(urlsToCrawl);
  console.log('✅ Done crawling.');
}

module.exports = ewgcrawler;


