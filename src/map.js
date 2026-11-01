import L from './leaflet.js';

export let map = null;
export let markersGroup = null;
export let importedGroup = null;      // Layer specifically for unclustered houses
export let measureLayerGroup = null;

export function initMap() {
    const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    });
    const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    });
    const googleTerrain = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    });

    map = L.map('map', {
        center: [-5.704853860737565, 139.18026931410546],
        zoom: 7,
        layers: [googleStreets],
        zoomControl: true,
        maxZoom: 20,
        preferCanvas: true
    });

    const baseMaps = {
        "Standard Map": googleStreets,
        "Satellite": googleSatellite,
        "Terrain": googleTerrain
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    markersGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 16,
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: `<div class="custom-cluster-inner">${cluster.getChildCount()}</div>`,
                className: 'custom-cluster-icon',
                iconSize: L.point(44, 44)
            });
        }
    });
    map.addLayer(markersGroup);

    importedGroup = L.featureGroup().addTo(map);
    measureLayerGroup = L.featureGroup().addTo(map);

    return map;
}
