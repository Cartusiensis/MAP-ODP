/* ============================
   SUPABASE SETUP
============================ */
// Replace these with your project URL and public Anon key!
const SUPABASE_URL = 'https://ektgxmnhlbpgcemepcfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gswwM7fTjhzZIfVP2VHDSA_Ixs4wa29';

// We name this 'db' to completely avoid any 'supabase' naming errors!
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

// Route Layer Group (Holds both border and inner line)
let routeLayerGroup = null;

/* ============================
   INITIALIZATION
============================ */
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchSupabaseData(); // Auto-load data when the page opens
});

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

    map.on('click', () => { closeDetail(); });
}

/* ============================
   DATABASE FETCH (SUPABASE)
============================ */
async function fetchSupabaseData() {
    showToast('Downloading data from secure database...', 'info');

    try {
        let allData = [];
        let isFetching = true;
        let startRow = 0;
        const batchSize = 1000;

        // Loop to bypass the 1000-row limit and fetch all 6000+ rows
        while (isFetching) {
            const { data, error } = await db
                .from('odp')
                .select('*')
                .range(startRow, startRow + batchSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                startRow += batchSize; // Move to the next batch
            }

            // If it returns less than 1000, we have reached the end of the database
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

            // Make it immune to uppercase/lowercase column names
            Object.keys(row).forEach(key => {
                const k = key.trim().toLowerCase().replace(/[_\s]+/g, '');
                
                if (['name','sitename','site'].includes(k)) normalized.name = String(row[key]).trim();
                else if (['latitude','lat','y'].includes(k)) normalized.latitude = parseFloat(row[key]);
                else if (['longitude','lng','lon','long','x'].includes(k)) normalized.longitude = parseFloat(row[key]);
                else if (['color','colour','statuscolor','markercolor'].includes(k)) normalized.color = String(row[key]).trim().toLowerCase();
                else normalized[key] = row[key]; 
            });

            // Require Name, Lat, and Long
            if (!normalized.name || isNaN(normalized.latitude) || isNaN(normalized.longitude)) return; 
            
            // Validate the color column
            if (!normalized.color || !validColors.includes(normalized.color)) {
                normalized.color = 'green'; 
            }
            
            parsed.push(normalized);
        });

        loadSites(parsed);
        showToast(`Loaded all ${parsed.length} sites from database!`, 'success');

    } catch (err) {
        console.error('Supabase error:', err.message);
        showToast('Failed to load database. Check Console.', 'error');
    }
}

/* ============================
   LOAD & RENDER
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
                L.DomEvent.stopPropagation(e);
                selectSite(idx);
            });

        marker.bindTooltip(site.name, { direction: 'top', offset: [0, -10], className: 'site-tooltip' });
        markersMap[idx] = marker;
        newMarkers.push(marker);
    });

    if (!document.getElementById('tooltip-style')) {
        const s = document.createElement('style');
        s.id = 'tooltip-style';
        s.textContent = `.site-tooltip { background:#1A2233 !important; color:#E6EDF3 !important; border:1px solid #2A3A50 !important; border-radius:8px !important; padding:4px 10px !important; font-family:'DM Sans',sans-serif !important; font-size:12px !important; font-weight:600 !important; box-shadow:0 4px 12px rgba(0,0,0,0.4) !important; } .site-tooltip::before { border-top-color:#1A2233 !important; }`;
        document.head.appendChild(s);
    }
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

    // Routing Logic
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

// Draw a Google-style layered walking route
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
        const distance = route.distance; // in meters
        
        // 1. Dark Blue Border Line
        const outlineLayer = L.geoJSON(geojson, {
            style: { color: '#1e40af', weight: 8, opacity: 0.8, lineCap: 'round', lineJoin: 'round' } 
        });
        
        // 2. Bright Blue Inner Line
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
    
    const metersStr = Math.round(distance).toLocaleString();

    container.innerHTML = `
        <div class="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-xl p-3 mb-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#3b82f6]/40">
                <i class="fa-solid fa-person-walking text-white text-lg"></i>
            </div>
            <div>
                <div class="text-sm font-bold text-fg">${metersStr} <span class="text-muted font-normal text-xs ml-1">meters</span></div>
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
        <!-- ROUTE INFO INJECTED HERE -->
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

/* ============================
   COORDINATE SEARCH
============================ */
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

    // Custom SVG to perfectly match the Classic Google Maps Red Pin
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