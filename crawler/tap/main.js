const { PlaywrightCrawler } = require('crawlee');
const storeTAPData = require('../../workers/tap/storeTAPData.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const BASE_URL = 'https://mytapwater.org/zip/';

async function tapcrawler(zipcodes) {
  console.log('🚀 Preparing to stream and crawl...');

  const urlsToCrawl = zipcodes.map((zip, index) => ({
    url: `${BASE_URL}${zip}`,
    userData: {
      zip,
      rowIndex: index,
    },
  }));

  console.log(`📄 Queued ${urlsToCrawl.length} URLs for crawling...`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxConcurrency: 1,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 45,
    maxRequestRetries: 2,

    async requestHandler({ request, page, enqueueLinks, log }) {
      const url = request.url;
      const delay = 1000 + Math.floor(Math.random() * 1500);
      await sleep(delay);
      const zip = request.userData.zip;

      log.info(`🕷️ Crawling row ${request.userData.rowIndex}: ${url}`);

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        if (response.status() === 429) {
          log.warning(`🛑 429 received at ${url}. Retrying after delay.`);
          await sleep(1000);
          throw new Error('Retrying after 429');
        }

        if (url.includes('/zip/')) {
          const row = await page.$('tr.pws-row');

          if (row) {
            const firstLink = await row.getAttribute('data-pws-deeplink');
            log.info(`🔗 Enqueuing first utility page: ${firstLink}`);
            await enqueueLinks({
              urls: [firstLink],
              label: 'UTILITY_DETAIL',
              userData: {
                zip,
                parentUrl: url,
              },
            });
          } else {
            log.warning(`⚠️ No utility rows found for ZIP: ${zip}`);
            // optionally await storeSkippedZip(zip);
          }
        }
        else if (url.includes('/pws/')) {

          log.info(`🔍 Scraping utility detail page for ZIP ${zip}`);

          await page.waitForSelector('#pws-info table', { timeout: 5000 });

          // Utility info
          const utilityInfo = await page.$eval('#pws-info table', (table) => {
            const raw = table.innerText.trim();
            const lines = raw.split('\n').map(line => line.trim());

            const data = {
              pwsId: null,
              type: null,
              epaRegion: null,
              serviceArea: null,
              source: null,
              populationServed: null,
              contactOrg: null,
              contactName: null,
              address: null,
              zip: null,
            };

            lines.forEach(line => {
              if (line.includes('PWS ID:')) data.pwsId = line.split('PWS ID:')[1].trim();
              else if (line.includes('Type:')) data.type = line.split('Type:')[1].trim();
              else if (line.includes('EPA Region:')) data.epaRegion = line.split('EPA Region:')[1].trim();
              else if (line.includes('Primary Service Area:')) data.serviceArea = line.split('Primary Service Area:')[1].trim();
              else if (line.includes('Primary Source:')) data.source = line.split('Primary Source:')[1].trim();
              else if (line.includes('Population Served:')) data.populationServed = line.split('Population Served:')[1].trim();
            });

            const contactLines = lines.filter(line =>
              line.includes('WATER DIVISION') || line.match(/\d{5}$/)
            );

            if (contactLines.length >= 3) {
              data.contactOrg = contactLines[0];
              data.contactName = contactLines[1];
              data.address = contactLines[2];
              data.zip = contactLines[2].match(/\d{5}$/)?.[0] ?? null;
            }

            return data;
          });

          // Violations table
          let violations = [];
          const hasViolations = await page.$('#violations table');
          if (hasViolations) {
            violations = await page.$$eval('#violations table tr:not(:first-child)', rows => {
              return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText.trim());
                return {
                  complianceDates: cells[0] || null,
                  rule: cells[1] || null,
                  violationType: cells[2] || null,
                  contaminantName: cells[3] || null,
                  status: cells[4] || null,
                };
              });
            });
          }

          // Final unified object
          const utilityData = {
            zip,
            sourceUrl: request.userData.parentUrl || request.url,
            pwsInfo: utilityInfo,
            violations: violations,
            timestamp: new Date().toISOString(),
          };

          log.info(`✅ Combined Utility Data for ZIP ${zip}:\n${JSON.stringify(utilityData, null, 2)}`);

          // Optional: pass to DB store function
          await storeTAPData(utilityData);

        }

      } catch (err) {
        log.error(`❌ Error processing ${url}: ${err.message}`);
        throw err;
      }
    },

    async failedRequestHandler({ request, error }) {
      console.error(`❌ Request failed: ${request.url}\nReason: ${error.message}`);
      // optional: await storeSkippedZip(request.userData.zip);
    },
  });

  console.log('🕷 Starting (Tap) crawler...');
  await crawler.run(urlsToCrawl);
  console.log('✅ Done crawling.');
}

module.exports = tapcrawler;