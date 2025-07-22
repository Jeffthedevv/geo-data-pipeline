const mongoose = require("mongoose");

const BasePage = new mongoose.Schema({
  title: { type: String, required: true },        // The title or identifier of the letter
  rawcontent: { type: String, required: true },      // The content or description of the letter
  publications: [{
    year: { type: String, required: true },   // Year of publication
    fullLink: { type: String, required: true }  // Full URL link for the publication
  }],
},
 { 
  timestamps: true,
  collection: 'OSHADOCS'
});

const BasePages = mongoose.model('BasePage', BasePage);

module.exports = BasePages;