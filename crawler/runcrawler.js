const fs = require('fs');
const readline = require('readline');
const path = require('path');
const startCrawler = require('./main');

const urlsPath = path.resolve(__dirname, '../output/urls.txt');

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream(urlsPath),
    crlfDelay: Infinity,
  });

  const urls = [];
  for await (const line of rl) {
    const url = line.trim();
    if (url) urls.push(url);
  }

  if (urls.length === 0) {
    console.error('❌ No URLs found in urls.txt');
    return;
  }

  await startCrawler(urls);
}

run();
