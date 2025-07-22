const mongoose = require("mongoose");

const ewgSchema = new mongoose.Schema({
  zip: { type: String, required: true },         // The zip code of the location || KEY
  title: { type: String, required: true },        // The title or identifier of the letter
  content: { type: String, required: true },      // The content or description of the letter
  year: { type : String, required: false },
  number: { type: String, required: false },       // The letter number (e.g., "Letter #123")

}, { 
  timestamp: true,
  collection: 'ewgdocs'
});

const Pages = mongoose.model('Page', ewgSchema);

module.exports = Pages;