# VisualAnalytics2025 | Final Project

<img src="https://apre.it/wp-content/uploads/2021/01/logo_uni-pisa.png" width="200" />

---
**Developed by:** [Matilde Contestabile](https://github.com/matildeec) \
**Academic year:** 2024/2025 \
**Master degree:** Data Science and Business Informatics

---

## Project Description

This project addresses **Mini-Challenge 2** (MC2) of the **VAST Challenge 2024**.

The objective is to investigate the behavior of vessels operating within the Oceanus maritime region using multiple datasets, including transponder ping records, harbor reports, and transaction logs. By analyzing these data sources, the challenge focuses on identifying patterns of suspicious activity to support Oceanus authorities in uncovering potentially illegal or concealed maritime behavior.

## Features

This repository includes:
- **Data Preprocessing**: Jupyter notebooks and Python scripts for data cleaning, inspection, and transformation.
- **Interactive Visualization**: Modern web dashboard built with Vue 3, Vite, D3.js, and TailwindCSS with visual tools to explore vessel trajectories, harbor events, and suspicious cargo transactions.

## Project Structure

- `/src` — Vue components, views, and routing.
- `/data` — All input datasets (JSON format).
- `/DataPreprocessing` — Jupyter notebooks and scripts for data cleaning and transformation.
- `.gitignore` — Ignores `node_modules`, build artifacts, logs, and local config.

## Installation & Usage

1. **Clone (or download) the repository**
   ```sh
   git clone https://github.com/matildeec/VisualAnalytics2025.git
   cd VisualAnalytics2025
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Run the development server**
   ```sh
   npm run dev
   ```
   The app will be available at [http://localhost:5173](http://localhost:5173) (default Vite port).

4. **Build for production**
   ```sh
   npm run build
   ```

5. **Preview the production build**
   ```sh
   npm run preview
   ```

## Requirements

- Node.js (built with v22.19.0)
- npm (built with v10.9.3)
- Modern browser (for the dashboard)
- Python 3.11.5 (for data preprocessing, if needed)
- Jupyter (for running notebooks in `/DataPreprocessing`)