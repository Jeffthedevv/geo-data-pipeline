const mongoose = require("mongoose");

const PageSchema = new mongoose.Schema({
  title: { type: String, required: true },        // The title or identifier of the letter
  content: { type: String, required: true },      // The content or description of the letter
  year: { type : String, required: false },
  number: { type: String, required: false },       // The letter number (e.g., "Letter #123")

}, { 
  timestamp: true,
  collection: 'OSHADOCS'
});

const Pages = mongoose.model('Page', PageSchema);

module.exports = Pages;