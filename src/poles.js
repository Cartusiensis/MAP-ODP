/* ============================
   POLES (KML/KMZ) CLOUD LOGIC
============================ */
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';
import L from './leaflet.js';
import { map } from './map.js';
import { POLES_FILE_URLS } from './config.js';
import { showToast } from './utils.js';

let polesGeoJSONData = null;
let polesLayer = null;
let showPoles = false;

export function getValidPoleUrls() {
    // Filter out empty or placeholder URLs
    return POLES_FILE_URLS.filter(url => url && !url.includes('YOUR_STORAGE'));
}

export async function fetchPolesFromCloud() {
    const loader = document.getElementById('poles-loader');
    loader.innerText = "Downloading poles...";

    const validUrls = getValidPoleUrls();
    if (validUrls.length === 0) {
        loader.innerText = "No pole URLs configured";
        return;
    }

    let allFeatures = [];
    let completed = 0;

    // Fetch all files concurrently
    const fetchPromises = validUrls.map(async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const isKMZ = url.toLowerCase().endsWith('.kmz');
            let kmlText = "";

            if (isKMZ) {
                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);

                let kmlFileName = null;
                zip.forEach((relativePath) => {
                    if (relativePath.toLowerCase().endsWith('.kml')) {
                        kmlFileName = relativePath;
                    }
                });

                if (!kmlFileName) throw new Error("No KML file found inside the KMZ archive.");
                kmlText = await zip.file(kmlFileName).async("text");
            } else {
                kmlText = await response.text();
            }

            const parser = new DOMParser();
            const kmlDocument = parser.parseFromString(kmlText, 'text/xml');
            const geojson = kml(kmlDocument);

            // Add the features from this file to our master list
            if (geojson.features && geojson.features.length > 0) {
                allFeatures.push(...geojson.features);
            }
        } catch (err) {
            console.error(`Error loading pole file (${url}):`, err);
        } finally {
            completed++;
            loader.innerText = `Downloading files (${completed}/${validUrls.length})...`;
        }
    });

    // Wait for all downloads and parsing to finish
    await Promise.all(fetchPromises);

    // Create a combined GeoJSON object
    polesGeoJSONData = {
        type: "FeatureCollection",
        features: allFeatures
    };

    if (allFeatures.length === 0) {
        loader.innerText = "No poles found in files";
        return;
    }

    // Build the map layer with the combined data
    buildPolesLayer();
    loader.innerText = `Ready (${allFeatures.length.toLocaleString()} poles)`;
}

function buildPolesLayer() {
    if (polesLayer) {
        map.removeLayer(polesLayer);
    }

    polesLayer = L.geoJSON(polesGeoJSONData, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 3.5,
                fillColor: "#94a3b8", // Slate Gray
                color: "#0f172a",     // Dark Gray Border
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9,
                bubblingMouseEvents: false // clicking a pole opens its popup, not a dropped pin
            });
        },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<div class="text-sm font-bold">${feature.properties.name}</div>`);
            }
        }
    });
}

export function togglePolesLayer() {
    if (!polesGeoJSONData) {
        showToast('Poles are still downloading or missing URL.', 'error');
        return;
    }
    showPoles = !showPoles;
    updatePolesUI();
    checkPolesVisibility();
}

function updatePolesUI() {
    const statusEl = document.getElementById('poles-status');
    if (showPoles) {
        statusEl.innerText = "ON";
        statusEl.classList.remove('text-red-400');
        statusEl.classList.add('text-green-400');
    } else {
        statusEl.innerText = "OFF";
        statusEl.classList.remove('text-green-400');
        statusEl.classList.add('text-red-400');
    }
}

export function checkPolesVisibility() {
    if (!polesLayer || !showPoles) {
        if (polesLayer && map.hasLayer(polesLayer)) map.removeLayer(polesLayer);
        return;
    }

    if (map.getZoom() >= 14) {
        if (!map.hasLayer(polesLayer)) map.addLayer(polesLayer);
    } else {
        if (map.hasLayer(polesLayer)) map.removeLayer(polesLayer);
    }
}
