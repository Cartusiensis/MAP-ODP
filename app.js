/* ============================
   SUPABASE SETUP
============================ */
// Replace these with your project URL and public Anon key!
const SUPABASE_URL = 'https://ektgxmnhlbpgcemepcfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gswwM7fTjhzZIfVP2VHDSA_Ixs4wa29';

const POLES_FILE_URLS = [
    'https://ektgxmnhlbpgcemepcfi.supabase.co/storage/v1/object/public/gis_data/TIANG%20STO%20TIMIKA.kmz',
    'https://ektgxmnhlbpgcemepcfi.supabase.co/storage/v1/object/public/gis_data/TIANG%20STO%20TEMBAGAPURA.kmz',
    'https://ektgxmnhlbpgcemepcfi.supabase.co/storage/v1/object/public/gis_data/TIANG%20STO%20KUALA%20KENCANA.kmz'
];

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================
   STATE & CONSTANTS
============================ */
const COLOR_MAP = {
    red:    '#EF4444',
    orange: '#F97316',
    yellow: '#EAB308',
    green:  '#22C55E',
    black:  '#475569'
};
const COLOR_LABELS = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    black: 'Black'
};

let sites = [];
let markersMap = {}; 
let map = null;
let markersGroup = null; 
let selectedIdx = null;
let activeFilter = null;
let listSearchQuery = "";
let searchMarker = null;

let routeLayerGroup = null;

let isMeasureToolOpen = false;
let measureMode = 'none'; 
let measurePoints = [];
let measureLayerGroup = null; 
let measureTempLayer = null; 
let measureTooltip = null;

// POLES (KML/KMZ) STATE
let polesGeoJSONData = null; 
let polesLayer = null;       
let showPoles = false;       

/* ============================
   INITIALIZATION
============================ */
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    
    // Check if user is already logged in
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
        unlockApp();
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (measureMode === 'distance' || measureMode === 'area')) {
            finishMeasure();
        }
    });
});

/* ============================
   AUTHENTICATION (OTP Flow)
============================ */
let authStep = 'email'; // Tracks whether we are sending email or verifying code

async function handleAuthFlow(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const btn = document.getElementById('auth-submit-btn');
    const errorEl = document.getElementById('auth-error');
    
    errorEl.classList.add('hidden');

    if (authStep === 'email') {
        // --- STEP 1: SEND OTP ---
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending Code...';
        
        const { error } = await db.auth.signInWithOtp({ 
            email: email,
            options: {
                // Should Supabase redirect them? We'll let it just verify on this page.
                shouldCreateUser: false // Extra security layer
            }
        });

        if (error) {
            btn.innerHTML = '<span>Send Login Code</span>';
            errorEl.innerText = error.message;
            errorEl.classList.remove('hidden');
        } else {
            // Success! Show OTP field
            authStep = 'otp';
            document.getElementById('email-step').classList.add('hidden');
            document.getElementById('otp-step').classList.remove('hidden');
            
            // Make email input readonly just in case we show it again later
            document.getElementById('auth-email').readOnly = true; 
            
            btn.innerHTML = '<span>Verify & Login</span>';
            showToast('Code sent! Check your email.', 'success');
        }

    } else if (authStep === 'otp') {
        // --- STEP 2: VERIFY OTP ---
        const token = document.getElementById('auth-otp').value.trim();
        if (!token) return;

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

        const { data, error } = await db.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) {
            btn.innerHTML = '<span>Verify & Login</span>';
            errorEl.innerText = "Invalid or expired code. Try again.";
            errorEl.classList.remove('hidden');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Success';
            unlockApp();
        }
    }
}

async function handleLogout() {
    await db.auth.signOut();
    // Reload the page to reset all map states and show login again
    window.location.reload();
}

function unlockApp() {
    // Hide the login screen
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => overlay.classList.add('hidden'), 300);

    // Fetch the data ONLY after successful login
    fetchSupabaseData(); 
    
    const hasValidPoleUrls = POLES_FILE_URLS.some(url => url && !url.includes('YOUR_STORAGE'));
    if (hasValidPoleUrls) {
        fetchPolesFromCloud();
    }
}

function initMap() {
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

    measureLayerGroup = L.featureGroup().addTo(map);

    map.on('click', (e) => {
        if (measureMode === 'distance' || measureMode === 'area') {
            handleMeasureClick(e);
        } else {
            closeDetail();
        }
    });

    map.on('mousemove', (e) => {
        if ((measureMode === 'distance' || measureMode === 'area') && measurePoints.length > 0) {
            handleMeasureMove(e);
        }
    });

    map.on('dblclick', (e) => {
        if (measureMode === 'distance' || measureMode === 'area') {
            finishMeasure();
        }
    });

    map.on('zoomend', () => {
        checkPolesVisibility();
    });
}

/* ============================
   POLES (KML/KMZ) CLOUD LOGIC
============================ */
async function fetchPolesFromCloud() {
    const loader = document.getElementById('poles-loader');
    loader.innerText = "Downloading poles...";

    // Filter out empty or placeholder URLs
    const validUrls = POLES_FILE_URLS.filter(url => url && !url.includes('YOUR_STORAGE'));
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
            const geojson = toGeoJSON.kml(kmlDocument);

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
                fillOpacity: 0.9
            });
        },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<div class="text-sm font-bold">${feature.properties.name}</div>`);
            }
        }
    });
}

function togglePolesLayer() {
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

function checkPolesVisibility() {
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

/* ============================
   DATABASE FETCH
============================ */
async function fetchSupabaseData() {
    showToast('Downloading odp from secure database...', 'info');

    try {
        let allData = [];
        let isFetching = true;
        let startRow = 0;
        const batchSize = 1000;

        while (isFetching) {
            const { data, error } = await db
                .from('odp')
                .select('*')
                .range(startRow, startRow + batchSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                startRow += batchSize;
            }

            if (!data || data.length < batchSize) {
                isFetching = false; 
            }
        }

        if (allData.length === 0) {
            showToast('Database is empty.', 'error');
            return;
        }

        const validColors = Object.keys(COLOR_MAP);
        const parsed = [];

        allData.forEach(row => {
            const normalized = {};

            Object.keys(row).forEach(key => {
                const k = key.trim().toLowerCase().replace(/[_\s]+/g, '');
                if (['name','sitename','site'].includes(k)) normalized.name = String(row[key]).trim();
                else if (['latitude','lat','y'].includes(k)) normalized.latitude = parseFloat(row[key]);
                else if (['longitude','lng','lon','long','x'].includes(k)) normalized.longitude = parseFloat(row[key]);
                else if (['color','colour','statuscolor','markercolor'].includes(k)) normalized.color = String(row[key]).trim().toLowerCase();
                else normalized[key] = row[key]; 
            });

            if (!normalized.name || isNaN(normalized.latitude) || isNaN(normalized.longitude)) return; 
            
            if (!normalized.color || !validColors.includes(normalized.color)) {
                normalized.color = 'green'; 
            }
            
            parsed.push(normalized);
        });

        loadSites(parsed);
        showToast(`Loaded ${parsed.length} odp from database!`, 'success');

    } catch (err) {
        console.error('Supabase error:', err.message);
        showToast('Failed to load database. Check Console.', 'error');
    }
}

/* ============================
   LOAD & RENDER SITES
============================ */
function loadSites(data) {
    sites = data;
    selectedIdx = null;
    activeFilter = null;
    listSearchQuery = "";
    document.getElementById('list-search-input').value = "";
    
    renderMarkers();
    renderLegend();
    renderSiteList();
    closeDetail();

    if (sites.length > 0) {
        setTimeout(() => fitAll(), 300);
    }
}

function renderMarkers() {
    markersGroup.clearLayers();
    markersMap = {};
    const newMarkers = [];

    sites.forEach((site, idx) => {
        if (activeFilter && site.color !== activeFilter) return;

        const icon = L.divIcon({
            className: 'marker-wrapper',
            html: `<div class="marker-dot" id="marker-dot-${idx}" data-idx="${idx}" style="background:${COLOR_MAP[site.color] || COLOR_MAP.green}"></div>`,
            iconSize: [14, 14], 
            iconAnchor: [7, 7]
        });

        const marker = L.marker([site.latitude, site.longitude], { icon })
            .on('click', (e) => {
                if (measureMode === 'distance' || measureMode === 'area') return;
                
                L.DomEvent.stopPropagation(e);
                selectSite(idx);
            });

        marker.bindTooltip(site.name, { direction: 'top', offset: [0, -10], className: 'site-tooltip' });
        markersMap[idx] = marker;
        newMarkers.push(marker);
    });

    markersGroup.addLayers(newMarkers);
}

function renderLegend() {
    const legend = document.getElementById('legend');
    const counts = {};
    Object.keys(COLOR_MAP).forEach(c => counts[c] = 0);
    sites.forEach(s => { if (counts[s.color] !== undefined) counts[s.color]++; });

    legend.innerHTML = Object.keys(COLOR_MAP).map(color => {
        const filtered = activeFilter === color;
        return `<div class="legend-dot ${filtered ? 'filtered' : ''} flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border text-xs text-muted hover:text-fg transition" onclick="toggleFilter('${color}')">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${COLOR_MAP[color]}; box-shadow:0 0 6px ${COLOR_MAP[color]}44"></span>
            <span>${COLOR_LABELS[color]}</span>
            <span class="text-[10px] font-bold text-fg/50">${counts[color]}</span>
        </div>`;
    }).join('');
    document.getElementById('total-count').textContent = sites.length;
}

function handleListSearch(e) {
    listSearchQuery = e.target.value.toLowerCase().trim();
    renderSiteList();
}

function renderSiteList() {
    const list = document.getElementById('site-list');
    const empty = document.getElementById('empty-state');
    
    const filtered = sites.map((s, i) => ({ ...s, _idx: i }))
        .filter(s => !activeFilter || s.color === activeFilter)
        .filter(s => !listSearchQuery || s.name.toLowerCase().includes(listSearchQuery));

    if (filtered.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        empty.classList.add('flex');
        return;
    }

    empty.classList.add('hidden');
    empty.classList.remove('flex');

    const displayLimit = 100;
    const displayList = filtered.slice(0, displayLimit);

    let html = displayList.map(site => {
        const isSelected = selectedIdx === site._idx;
        return `<div class="site-item ${isSelected ? 'selected' : ''} flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer" onclick="selectSite(${site._idx})" data-idx="${site._idx}">
            <span class="w-3.5 h-3.5 rounded-full flex-shrink-0" style="background:${COLOR_MAP[site.color] || COLOR_MAP.green}; box-shadow:0 0 8px ${COLOR_MAP[site.color] || COLOR_MAP.green}55"></span>
            <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-fg truncate">${escHtml(site.name)}</div>
            </div>
        </div>`;
    }).join('');

    if (filtered.length > displayLimit) {
        html += `<div class="text-center text-[10px] text-muted py-2 bg-card/50 rounded-lg mt-2 mb-1 border border-dashed border-border">Showing 100 of ${filtered.length}. Use search to narrow down.</div>`;
    }
    list.innerHTML = html;
}

/* ============================
   SELECTION, DETAIL & ROUTING
============================ */
function selectSite(idx) {
    selectedIdx = idx;
    const site = sites[idx];
    const targetMarker = markersMap[idx];

    document.querySelectorAll('.site-item').forEach(item => {
        item.classList.remove('selected');
        if (parseInt(item.dataset.idx) === idx) item.classList.add('selected');
    });

    showDetail(site);

    if (searchMarker) {
        const start = searchMarker.getLatLng();
        const end = L.latLng(site.latitude, site.longitude);
        
        document.querySelectorAll('.marker-dot').forEach(dot => dot.classList.remove('active'));
        const dot = document.getElementById(`marker-dot-${idx}`);
        if (dot) dot.classList.add('active');

        calculateAndDrawRoute(start, end);
    } else {
        if (targetMarker) {
            markersGroup.zoomToShowLayer(targetMarker, () => {
                document.querySelectorAll('.marker-dot').forEach(dot => dot.classList.remove('active'));
                const dot = document.getElementById(`marker-dot-${idx}`);
                if (dot) dot.classList.add('active');
            });
        }
    }
}

async function calculateAndDrawRoute(start, end) {
    if (routeLayerGroup) {
        map.removeLayer(routeLayerGroup);
        routeLayerGroup = null;
    }
    
    const routeContainer = document.getElementById('route-info-container');
    if(routeContainer) {
        routeContainer.innerHTML = `<div class="bg-surface/50 rounded-xl p-3 mb-4 flex items-center justify-center text-xs text-muted"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Calculating walking route...</div>`;
    }

    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code !== 'Ok') throw new Error('No route found');
        
        const route = data.routes[0];
        const geojson = route.geometry;
        const distance = route.distance; 
        
        const outlineLayer = L.geoJSON(geojson, {
            style: { color: '#1e40af', weight: 8, opacity: 0.8, lineCap: 'round', lineJoin: 'round' } 
        });
        const innerLayer = L.geoJSON(geojson, {
            style: { color: '#3b82f6', weight: 4.5, opacity: 1.0, lineCap: 'round', lineJoin: 'round' } 
        });

        routeLayerGroup = L.layerGroup([outlineLayer, innerLayer]).addTo(map);
        map.flyToBounds(outlineLayer.getBounds(), { padding: [80, 80], duration: 0.8 });
        
        updateRouteUI(distance);

    } catch (err) {
        console.error(err);
        if(routeContainer) routeContainer.innerHTML = '';
        showToast('Could not find a walking route.', 'error');
    }
}

function updateRouteUI(distance) {
    const container = document.getElementById('route-info-container');
    if (!container) return;
    
    let distStr = distance < 1000 
        ? `${Math.round(distance).toLocaleString()} m` 
        : `${(distance / 1000).toFixed(2)} km`;

    container.innerHTML = `
        <div class="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-xl p-3 mb-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#3b82f6]/40">
                <i class="fa-solid fa-person-walking text-white text-lg"></i>
            </div>
            <div>
                <div class="text-sm font-bold text-fg">${distStr}</div>
                <div class="text-xs text-muted font-medium">Walking Distance</div>
            </div>
        </div>
    `;
}

function showDetail(site) {
    const panel = document.getElementById('detail-panel');
    const bar = document.getElementById('detail-color-bar');
    const content = document.getElementById('detail-content');

    bar.style.background = COLOR_MAP[site.color] || COLOR_MAP.green;

    const skipKeys = new Set(['name','latitude','longitude','color']);
    const fields = Object.entries(site).filter(([k]) => !skipKeys.has(k));

    content.innerHTML = `
        <div class="mb-5">
            <div class="flex items-center gap-3 mb-2">
                <span class="w-5 h-5 rounded-full flex-shrink-0" style="background:${COLOR_MAP[site.color] || COLOR_MAP.green}; box-shadow:0 0 10px ${COLOR_MAP[site.color] || COLOR_MAP.green}66"></span>
                <h2 class="font-display font-bold text-xl text-fg">${escHtml(site.name)}</h2>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted">
                <i class="fa-solid fa-location-dot text-accent/60"></i>
                <span>${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}</span>
            </div>
        </div>
        <div id="route-info-container"></div>
        <div class="space-y-0">
            ${fields.length > 0 ? fields.map(([key, val]) => `
                <div class="flex justify-between items-start py-2.5 border-b border-border/50 last:border-0">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted/70 min-w-[80px]">${escHtml(key)}</span>
                    <span class="text-sm text-fg text-right flex-1 ml-3 break-words">${escHtml(String(val ?? '—'))}</span>
                </div>
            `).join('') : '<p class="text-sm text-muted">No additional details.</p>'}
        </div>
    `;
    panel.classList.add('open');
}

function closeDetail() {
    document.getElementById('detail-panel').classList.remove('open');
    selectedIdx = null;
    document.querySelectorAll('.marker-dot').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.site-item').forEach(i => i.classList.remove('selected'));
    
    if (routeLayerGroup) {
        map.removeLayer(routeLayerGroup);
        routeLayerGroup = null;
    }
}

function panToSelected() {
    if (selectedIdx !== null && sites[selectedIdx]) {
        const s = sites[selectedIdx];
        map.flyTo([s.latitude, s.longitude], 18, { duration: 0.6 }); 
    }
}

function toggleFilter(color) {
    activeFilter = activeFilter === color ? null : color;
    renderMarkers();
    renderLegend();
    renderSiteList();
    closeDetail();
}

function searchCoord() {
    const input = document.getElementById('coord-input').value.trim();
    if (!input) return;

    const parts = input.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
    if (parts.length < 2) {
        showToast('Invalid format. Use: latitude, longitude', 'error');
        return;
    }
    const [lat, lng] = parts;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showToast('Coordinates out of range.', 'error');
        return;
    }

    if (searchMarker) map.removeLayer(searchMarker);
    if (routeLayerGroup) { map.removeLayer(routeLayerGroup); routeLayerGroup = null; }
    closeDetail(); 

    const googlePinSVG = `
    <svg viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 54 20 54C20 54 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#EA4335" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="20" cy="20" r="7" fill="#7A1810"/>
    </svg>`;

    const icon = L.divIcon({
        className: 'marker-wrapper',
        html: `<div class="google-red-pin">${googlePinSVG}</div>`,
        iconSize: [36, 48],
        iconAnchor: [18, 48] 
    });
    
    searchMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 18, { duration: 0.8 });
    
    document.getElementById('clear-pin-btn').classList.remove('hidden');
    showToast(`Pin dropped at ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
}

function clearSearchPin() {
    if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
    if (routeLayerGroup) { map.removeLayer(routeLayerGroup); routeLayerGroup = null; }
    
    const routeContainer = document.getElementById('route-info-container');
    if (routeContainer) routeContainer.innerHTML = '';

    document.getElementById('clear-pin-btn').classList.add('hidden');
    document.getElementById('coord-input').value = '';
    showToast('Search pin and routes cleared', 'info');
}

function fitAll() {
    if (Object.keys(markersMap).length === 0) {
        showToast('No sites to fit', 'error');
        return;
    }
    const bounds = markersGroup.getBounds();
    if(bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8, maxZoom: 14 });
    }
}

/* ============================
   MEASURE TOOL LOGIC 
============================ */
function toggleMeasureTool() {
    const toolbar = document.getElementById('measure-toolbar');
    isMeasureToolOpen = !isMeasureToolOpen;
    
    if (isMeasureToolOpen) {
        toolbar.classList.remove('hidden');
        toolbar.classList.add('flex');
        setMeasureMode('distance'); 
    } else {
        toolbar.classList.add('hidden');
        toolbar.classList.remove('flex');
        setMeasureMode('none');
        clearMeasure();
    }
}

function setMeasureMode(mode) {
    measureMode = mode;
    clearMeasure(); 

    document.getElementById('btn-measure-dist').classList.remove('measure-btn-active');
    document.getElementById('btn-measure-area').classList.remove('measure-btn-active');
    
    if (mode === 'distance') document.getElementById('btn-measure-dist').classList.add('measure-btn-active');
    if (mode === 'area') document.getElementById('btn-measure-area').classList.add('measure-btn-active');

    if (mode === 'distance' || mode === 'area') {
        document.getElementById('map').classList.add('measuring-mode');
        map.doubleClickZoom.disable(); 
    } else {
        document.getElementById('map').classList.remove('measuring-mode');
        map.doubleClickZoom.enable();
    }
}

function clearMeasure() {
    measurePoints = [];
    measureLayerGroup.clearLayers();
    if (measureTempLayer) map.removeLayer(measureTempLayer);
    if (measureTooltip) map.removeLayer(measureTooltip);
    measureTempLayer = null;
    measureTooltip = null;
    document.getElementById('measure-result').innerText = '0 m';
}

function handleMeasureClick(e) {
    measurePoints.push(e.latlng);

    L.circleMarker(e.latlng, {
        radius: 4, color: '#F0883E', fillColor: '#fff', fillOpacity: 1, weight: 2
    }).addTo(measureLayerGroup);

    if (measurePoints.length > 1) {
        measureLayerGroup.clearLayers(); 

        measurePoints.forEach(p => {
            L.circleMarker(p, { radius: 4, color: '#F0883E', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(measureLayerGroup);
        });

        if (measureMode === 'distance') {
            L.polyline(measurePoints, { color: '#F0883E', weight: 4 }).addTo(measureLayerGroup);
        } else if (measureMode === 'area') {
            L.polygon(measurePoints, { color: '#F0883E', weight: 4, fillColor: '#F0883E', fillOpacity: 0.2 }).addTo(measureLayerGroup);
        }
    }
    updateMeasureMath();
}

function handleMeasureMove(e) {
    if (measureTempLayer) map.removeLayer(measureTempLayer);
    if (measureTooltip) map.removeLayer(measureTooltip);

    const tempPoints = [...measurePoints, e.latlng];

    if (measureMode === 'distance') {
        measureTempLayer = L.polyline(tempPoints, { color: '#F0883E', weight: 4, dashArray: '8, 8' }).addTo(map);
    } else if (measureMode === 'area') {
        measureTempLayer = L.polygon(tempPoints, { color: '#F0883E', weight: 4, dashArray: '8, 8', fillColor: '#F0883E', fillOpacity: 0.2 }).addTo(map);
    }

    measureTooltip = L.tooltip({
        permanent: true, direction: 'right', className: 'measure-tooltip', offset: [15, 0]
    }).setLatLng(e.latlng);

    const resultStr = updateMeasureMath(tempPoints);
    measureTooltip.setContent(resultStr).addTo(map);
}

function finishMeasure() {
    if (measureMode !== 'distance' && measureMode !== 'area') return;

    if (measurePoints.length > 0) {
        measurePoints.pop();
    }
    
    if (measureTempLayer) map.removeLayer(measureTempLayer);
    if (measureTooltip) map.removeLayer(measureTooltip);
    measureTempLayer = null;
    measureTooltip = null;
    
    measureLayerGroup.clearLayers();
    measurePoints.forEach(p => {
        L.circleMarker(p, { radius: 4, color: '#F0883E', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(measureLayerGroup);
    });

    if (measureMode === 'distance') {
        L.polyline(measurePoints, { color: '#F0883E', weight: 4 }).addTo(measureLayerGroup);
    } else if (measureMode === 'area') {
        L.polygon(measurePoints, { color: '#F0883E', weight: 4, fillColor: '#F0883E', fillOpacity: 0.2 }).addTo(measureLayerGroup);
    }

    updateMeasureMath(measurePoints);
    
    measureMode = 'finished';
    
    document.getElementById('map').classList.remove('measuring-mode');
    document.getElementById('btn-measure-dist').classList.remove('measure-btn-active');
    document.getElementById('btn-measure-area').classList.remove('measure-btn-active');
    
    setTimeout(() => { map.doubleClickZoom.enable(); }, 300);
}

function updateMeasureMath(pointsArray = measurePoints) {
    if (pointsArray.length < 2) return '0 m';

    let resultStr = '0 m';

    if (measureMode === 'distance' || measureMode === 'finished') {
        let totalMeters = 0;
        for (let i = 0; i < pointsArray.length - 1; i++) {
            totalMeters += pointsArray[i].distanceTo(pointsArray[i+1]);
        }
        
        if (totalMeters < 1000) {
            resultStr = `${Math.round(totalMeters).toLocaleString()} m`;
        } else {
            resultStr = `${(totalMeters / 1000).toFixed(2)} km`;
        }

    } 
    
    if (measureMode === 'area' || (measureMode === 'finished' && pointsArray.length > 2)) {
        if (pointsArray.length < 3) return '0 m²';
        
        const turfCoords = pointsArray.map(p => [p.lng, p.lat]);
        turfCoords.push([pointsArray[0].lng, pointsArray[0].lat]);
        
        const polygon = turf.polygon([turfCoords]);
        const areaMeters = turf.area(polygon);

        if (areaMeters < 10000) {
            resultStr = `${Math.round(areaMeters).toLocaleString()} m²`;
        } else {
            resultStr = `${(areaMeters / 1000000).toFixed(3)} km²`;
        }
    }

    document.getElementById('measure-result').innerText = resultStr;
    return resultStr;
}

/* ============================
   UTILITIES
============================ */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
    document.getElementById('sidebar-overlay').classList.toggle('show');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const colors = {
        success: 'bg-green-900/90 border-green-700/60 text-green-200',
        error: 'bg-red-900/90 border-red-700/60 text-red-200',
        info: 'bg-card border-border text-fg'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-xl ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-xs"></i><span>${escHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3000);
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}