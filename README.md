# geo-data-pipeline

A real-time environmental data pipeline built for geospatial visualization and public consumption.

![Node.js](https://img.shields.io/badge/built%20with-Node.js-green?logo=node.js)
![MongoDB](https://img.shields.io/badge/database-MongoDB-brightgreen?logo=mongodb)

---

### 💡 Features
- Crawls structured public datasets by ZIP code
- Indexes and summarizes contaminant data per region
- Outputs geo-ready datasets with latitude/longitude formatting
- Supports both full and lightweight collections for fast frontend loading
- Designed to plug into tools like Mapbox or Leaflet

---

### 🗂 Directory Structure
geo-data-pipeline/
├── api/
│ ├── routes/
│ ├── services/
│ └── server.js
├── scripts/
│ ├── crawler.js
│ ├── generateHeatmapPoints.js
│ ├── generateHeatmapLight.js
│ └── importGlossary.js
├── data/
│ └── glossary.tsv
├── .env.example
├── README.md
└── LICENSE

---

### 🛠 Tech Stack
`Node.js` `MongoDB` `Koa` `Playwright` `Mapbox` `GeoJSON` `CSV`

---

### 🚀 Getting Started

1. **Clone this repository:**
   ```bash
   git clone https://github.com/Jeffthedevv/geo-data-pipeline.git
   cd geo-data-pipeline
2. Create a .env file using the template:
   cp .env.example .env
3. Run setup and data prep scripts:
   node scripts/importGlossary.js
   node scripts/generateHeatmapPoints.js
   node scripts/generateHeatmapLight.js
4. Start the API:
    node api/server.js


### 📦 Available API Endpoints

GET /v1/heatmap_points → Returns full enriched dataset per ZIP
GET /v1/heatmap_points_light → Returns lightweight dataset (ZIP + lat/lng)

### 🔍 Sample API Response
{
  "zip": "90210",
  "lat": 34.0901,
  "lon": -118.4065,
  "city": "Beverly Hills",
  "state": "CA"
}

### 📘 License
This project is licensed under the MIT License.

### ✍️ Author
  Jeffery Diaz
  LinkedIn • GitHub

###⚠️ This repo is for educational and technical demonstration purposes. 
### Data and endpoints provided here are intended for prototype and non-commercial use.
