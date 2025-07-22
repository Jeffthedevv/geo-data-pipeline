const { PlaywrightCrawler } = require('crawlee');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const baseURL = '';

async function startCrawlerStreamed() {
  console.log('🚀 Preparing to stream and crawl...');

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(inputFile);
  const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: outputFile });
  const sheetWriter = workbookWriter.addWorksheet('Sheet1');

  const urlsToCrawl = [];
  const rowCache = [];

  let rowIndex = 0;
  for await (const worksheet of workbookReader) {
    for await (const row of worksheet) {
      rowIndex++;
      const values = row.values;
      const cellVal = values[1]; // Column A

      if (rowIndex === 1) {
        sheetWriter.addRow(values).commit();
        rowCache.push(null);
        continue;
      }

      const id = typeof cellVal === 'object' && cellVal !== null
        ? cellVal.text || cellVal.result || cellVal.hyperlink
        : String(cellVal);

      if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
        sheetWriter.addRow(values).commit();
        rowCache.push(null);
        continue;
      }

      const fullUrl = baseURL + String(id).trim();
      urlsToCrawl.push({ url: fullUrl, rowIndex });
      rowCache.push(values);
    }
  }

  console.log(`📄 Queued ${urlsToCrawl.length} URLs for crawling...`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxConcurrency: 2,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 30,
    maxRequestRetries: 2,
    autoscaledPoolOptions: {
      desiredConcurrencyRatio: 0.7,
      scaleUpStepRatio: 0.1,
      scaleDownStepRatio: 0.2,
    },

    async requestHandler({ request, page, log }) {
      const { url, rowIndex } = request.userData;
      console.log(`🕷️ Crawling row ${rowIndex}: ${url}`);

      const jitter = Math.floor(Math.random() * 500); // 0–500ms
      await sleep(1000 + jitter);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const contacts = await page.evaluate(() => {
        const results = [];
        const headers = Array.from(document.querySelectorAll('h4'));
        const contactsHeader = headers.find(h => h.textContent?.trim().toLowerCase() === 'contacts');
        if (!contactsHeader) return results;

        let table = contactsHeader.nextElementSibling;
        while (table && table.tagName !== 'TABLE') {
          table = table.nextElementSibling;
        }

        if (!table) return results;

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 5) continue;
          results.push({
            affiliationType: cells[0].innerText.trim(),
            fullName: cells[1].innerText.trim(),
            officePhone: cells[2].innerText.trim(),
            infoSystem: cells[3].innerText.trim(),
            mailingAddress: cells[4].innerText.trim(),
          });
        }

        return results;
      });

      const originalValues = rowCache[rowIndex - 1] || [];
      const padded = [...originalValues];

      if (contacts.length) {
        let col = 8; // H
        for (const contact of contacts) {
          padded[col++] = contact.affiliationType;
          padded[col++] = contact.fullName;
          padded[col++] = contact.officePhone;
          padded[col++] = contact.infoSystem;
          padded[col++] = contact.mailingAddress;
        }
      }

      sheetWriter.addRow(padded).commit();
      console.log(`✅ Row ${rowIndex} updated with ${contacts.length} contact(s)`);
    },

    failedRequestHandler({ request, error }) {
      console.error(`❌ Request failed: ${request.url}\nReason: ${error.message}`);
    }
  });

  console.log('🕷 Starting crawler...');
  await crawler.run(
    urlsToCrawl.map(entry => ({
      url: entry.url,
      userData: entry,
    }))
  );

  console.log('💾 Finalizing Excel output...');
  await workbookWriter.commit();

  console.log(`✅ DONE! Output saved to: ${outputFile}`);
}

module.exports = startCrawlerStreamed;


// Stoped at row 11202
