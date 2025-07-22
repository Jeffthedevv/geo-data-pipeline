require("dotenv"); // Load environment variables\

const mongoose = require("mongoose");

/**
* Connection URI. Update <username>, <password>, and <your-cluster-url> to reflect your cluster.
* See https://docs.mongodb.com/ecosystem/drivers/node/ for more details
*/

async function connectDB() {

  // const MONGO_URL = process.env.MONGO_URL // Ideally there would be a "or statement here as a fallback"

  try {
    await  mongoose.connect( process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error);
        process.exit(1); // Stop the app if DB connection fails
    }
}

module.exports = connectDB

