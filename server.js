require("dotenv").config(); // Load environment variables at the very beginning

const Koa = require("koa");
const mongoose = require('mongoose');
const router = require("./router");
const readline = require('readline');

const parser = require("koa-bodyparser");
const logger = require("koa-logger");
const cors = require("@koa/cors");

//EWG Functions
const getZipcodesFromDB = require("./workers/getzips"); // Import the ZIP code worker
const ewgcrawler = require("./crawler/ewg/main"); // Import the crawler module.

// TAP Functions
const tapcrawler = require("./crawler/tap/main"); // Import the TAP crawler module.
 
// EPA Functions
const extractUrls = require("./utility/epa/geturls"); // Import the URL extraction function
// Epa Regulations Functions
const epaRegCrawler = require("./crawler/epa/main"); // Import the EPA crawler module.
const epaContaminants = require("./crawler/epa_contam/main"); // Import the EPA contaminants crawler module.

// Azure Cosmos DB Migration
const { migrateCollection } = require("./utility/dbController/main"); // Import the migration function
const { testCosmosConnection } = require("./utility/dbController/test"); // Import the Cosmos DB test function

// Oasis Health Crawler
const startOasisCrawler = require("./crawler/oasis/main"); // Import the Oasis crawler module
const retryOasisCrawler = require("./crawler/oasis/retry"); // Import the retry module for Oasis crawler
const { crawlOasisProductPages } = require("./crawler/oasis/bottles"); // Import the Oasis product page crawler

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const App = new Koa();
const PORT = process.env.PORT || 3000;

App
  .use(parser())
  .use(logger())
  .use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

  
// Start the server immediately
App.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}/`);
  serverPrompt(); // Call the serverPrompt function to start the prompt
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function serverPrompt() {
  console.log("Choose a crawling option:");
  console.log("1. Start Crawler For EPA");
  console.log("2. Start Crawler For EWG");
  console.log("3. Start Crawler For TAP");
  console.log("4. Start Crawler For EPA Regulations");
  console.log("5. Update Azure Cosmos DB with Local MongoDB Data");
  console.log("6. Start Crawler for Oasis");
  console.log("7. Start Craweler for EPA Contaminants");
  console.log("8. Retry Crawler for Oasis");
  console.log("9. Start Crawler for Oasis Product Pages");
  
  const choice = await askQuestion("Enter your choice: ");

  if (choice === "1") {
    console.log("🚀 Starting Crawler For EPA...\n");

    console.log("Extract URLs from Excel?");
    console.log("1. Yes");
    console.log("2. No");

    const extractChoice = await askQuestion("Enter your choice (1 or 2): ");

    if (extractChoice === "1") {
      console.log("🚀 Starting URL extraction from Excel...");
      try {
        await extractUrls();
        console.log("✅ URL extraction completed successfully.");
      } catch (error) {
        console.error("❌ Error during URL extraction:", error);
      }
      } else if (extractChoice === "2") {
        console.log("✅ Skipping URL extraction from Excel.");
      } else {
        console.log("❌ Invalid choice. Please enter 1 or 2.");
      }

  } else if (choice === "2") {
    console.log("🚀 Starting Crawler For EWG...");
    await initializeDB();
    await intializeCrawlerEWG();
  } else if (choice === "3") {
    console.log("🚀 Starting Crawler For TAP...");
    await initializeDB();
    await initializeCrawlerTap();
  } else if (choice === "4") {
    console.log("🚀 Starting Crawler For EPA Regulations...");
    await initializeDB();
    await epaRegCrawler(); 
  } else if (choice === "5") {
    console.log("🚀 Starting Migration to Azure Cosmos DB...");
    await initializeDB();
    await runMigration()
  } else if (choice === "6") {
    console.log("🚀 Starting Crawler for Oasis Health...");
    await initializeDB();
    await startOasisCrawler(); // Start the Oasis crawler
  } else if (choice === "7") {
    await initializeDB();
    console.log("🚀 Starting Test for Cosmos DB Connection...");
    await epaComtaminants(); // Start the EPA contaminants crawler
  } else if (choice === "8") {
    console.log("🚀 Starting Retry Crawler for Oasis...");
    await initializeDB();
    await retryOasisCrawler(); // Start the retry crawler for Oasis
  } else if (choice === "9") {
    console.log("🚀 Starting Crawler for Oasis Product Pages...");
    await initializeDB();
    await crawlOasisProductPages(); // Start the Oasis product page crawler
  } else {
    console.log("❌ Invalid choice. Please enter 1 or 2.");
  }

  rl.close();
}

// START EWG Function Calls & DB Initialization. 
async function intializeCrawlerEWG() {
  console.log("🚀 Zip Code  Extractor Init ...");
  const zipcodes = await getZipcodesFromDB(1000,''); // Get ZIP codes from the database

  if (zipcodes.length != 0) {
    console.log("✅ ZIP codes found in the database.");
    console.log("ZipCodes: ", zipcodes);
    await ewgcrawler(zipcodes); // Pass the ZIP codes to the crawler
  } else {
    console.log("❌ No ZIP codes found in the database.");
    return;
  }
}

async function initializeCrawlerTap() {
  console.log("🚀 Zip Code  Extractor Init ...");
  const zipcodes = await getZipcodesFromDB(1000,'99824'); // Get ZIP codes from the database

  if (zipcodes.length != 0) {
    console.log("✅ ZIP codes found in the database.");
    console.log("ZipCodes: ", zipcodes);
    await tapcrawler(zipcodes); // Pass the ZIP codes to the crawler
  } else {
    console.log("❌ No ZIP codes found in the database.");
    return;
  }
}

async function initializeDB() {
  try {
    const dbURI = process.env.MONGODB_URI || "mongodb://localhost:27017/";
    await mongoose.connect(dbURI);
    console.log("✅ MongoDB connected successfully.");
    // importZipcodes(); // Call the import function here
   
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
  }
}

async function runMigration() {
  await migrateCollection({
    cosmosUri: "",
    dbName: "",
    collectionName: "",           // Local collection name
    targetCollectionName: "",        // Cosmos DB target collection
    batchSize: 5,
    transform: (doc) => {
      delete doc._id; // Optional: Let Cosmos assign new _id
      return doc;
    }
  });
}

async function runTest() {
  const cosmosUri = "";
  const dbName = "";

  const result = await testCosmosConnection(cosmosUri, dbName);

  if (result.success) {
    console.log("🎉 Connection successful. Collections:", result.collections);
  } else {
    console.error("🚫 Connection failed:", result.error);
  }

}

