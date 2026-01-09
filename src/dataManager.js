import * as d3 from 'd3';
const BASE_URL = import.meta.env.BASE_URL

// Cache variable for the datasets
let _geoData = null;
let _vesselsData = null;
let _pingsData = null;
let _transactionsData = null;
let _trajectoriesData = null;
let _commoditiesData = null;
let _documentsData = null;
let _locations = null;
let _harborReportsData = null;

// Individual datasets
export async function getGeoData() {
    if (_geoData) return _geoData;
    
    _geoData = await d3.json(`${BASE_URL}data/oceanus.geojson`);
    return _geoData;
}

export async function getVessels() {
    if (_vesselsData) return _vesselsData;
    
    _vesselsData = await d3.json(`${BASE_URL}data/vessels.json`);
    return _vesselsData;
}

export async function getPings() {
    if (_pingsData) return _pingsData;
    
    _pingsData = await d3.json(`${BASE_URL}data/transponder_pings.json`);
    return _pingsData;
}

export async function getTransactions() {
    if (_transactionsData) return _transactionsData;
    
    _transactionsData = await d3.json(`${BASE_URL}data/transactions.json`);
    return _transactionsData;
}

export async function getTrajectories() {
    if (_trajectoriesData) return _trajectoriesData;
    
    _trajectoriesData = await d3.json(`${BASE_URL}data/trajectories.json`);
    return _trajectoriesData;
}

export async function getCommodities() {
    if (_commoditiesData) return _commoditiesData;
    
    _commoditiesData = await d3.json(`${BASE_URL}data/commodities.json`);
    return _commoditiesData;
}

export async function getDocuments() {
    if (_documentsData) return _documentsData;
    
    _documentsData = await d3.json(`${BASE_URL}data/documents.json`);
    return _documentsData;
}

export async function getLocations() {
    if (_locations) return _locations;
    
    _locations = await d3.json(`${BASE_URL}data/locations.json`);
    return _locations;
}

export async function getHarborReports() {
    if (_harborReportsData) return _harborReportsData;
    
    _harborReportsData = await d3.json(`${BASE_URL}data/harbor_reports.json`);
    return _harborReportsData;
}

// Function to get correct path for assets
export function getAssetPath(relativePath) {
    return `${BASE_URL}assets/${relativePath}`;
}