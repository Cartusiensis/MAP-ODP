/* ============================
   DATABASE FETCH, LOAD & RENDER SITES
============================ */
import L from './leaflet.js';
import { db } from './supabase.js';
import { map, markersGroup, importedGroup } from './map.js';
import { state, isMeasuring } from './state.js';
import { COLOR_MAP, COLOR_LABELS } from './config.js';
import { showToast, escHtml } from './utils.js';
import { selectSite, closeDetail } from './detail.js';

export async function fetchSupabaseData() {
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

        loadDbSites(parsed);
        showToast(`Loaded ${parsed.length} odp from database!`, 'success');

    } catch (err) {
        console.error('Supabase error:', err.message);
        showToast('Failed to load database. Check Console.', 'error');
    }
}

function loadDbSites(data) {
    state.dbSites = data;
    combineAndRender();
    if (state.dbSites.length > 0) setTimeout(() => fitAll(), 300);
}

export function combineAndRender() {
    // Merge database and imported sites
    state.sites = [...state.dbSites, ...state.importedSites];

    state.selectedIdx = null;

    renderMarkers();
    renderLegend();
    renderSiteList();
    closeDetail();
}

function renderMarkers() {
    markersGroup.clearLayers();
    if (importedGroup) importedGroup.clearLayers();

    state.markersMap = {};
    const newMarkers = [];
    const newImported = [];

    state.sites.forEach((site, idx) => {
        if (state.activeFilter && site.color !== state.activeFilter) return;

        let isImported = site.isImported;
        let html = '';
        if (isImported) {
            html = `<div class="marker-house" id="marker-dot-${idx}" data-idx="${idx}"><i class="fa-solid fa-house"></i></div>`;
        } else {
            html = `<div class="marker-dot" id="marker-dot-${idx}" data-idx="${idx}" style="background:${COLOR_MAP[site.color] || COLOR_MAP.green}"></div>`;
        }

        const icon = L.divIcon({
            className: 'marker-wrapper',
            html: html,
            iconSize: isImported ? [28, 28] : [14, 14], // Made houses slightly bigger
            iconAnchor: isImported ? [14, 14] : [7, 7]
        });

        // Add zIndexOffset so houses always sit on top of ODP dots
        const marker = L.marker([site.latitude, site.longitude], {
            icon: icon,
            zIndexOffset: isImported ? 1000 : 0
        }).on('click', (e) => {
            if (isMeasuring()) return;
            L.DomEvent.stopPropagation(e);
            selectSite(idx);
        });

        marker.bindTooltip(site.name, { direction: 'top', offset: [0, -12], className: 'site-tooltip' });
        state.markersMap[idx] = marker;

        if (isImported) {
            newImported.push(marker);
        } else {
            newMarkers.push(marker);
        }
    });

    markersGroup.addLayers(newMarkers);
    if (importedGroup) {
        newImported.forEach(marker => importedGroup.addLayer(marker));
    }
}

function renderLegend() {
    const legend = document.getElementById('legend');
    const counts = {};
    Object.keys(COLOR_MAP).forEach(c => counts[c] = 0);
    counts['imported'] = 0; // Tracking imported separately

    state.sites.forEach(s => {
        if (s.isImported) counts['imported']++;
        else if (counts[s.color] !== undefined) counts[s.color]++;
    });

    let html = Object.keys(COLOR_MAP).map(color => {
        const filtered = state.activeFilter === color;
        return `<div class="legend-dot ${filtered ? 'filtered' : ''} flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border text-xs text-muted hover:text-fg transition" data-color="${color}">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${COLOR_MAP[color]}; box-shadow:0 0 6px ${COLOR_MAP[color]}44"></span>
            <span>${COLOR_LABELS[color]}</span>
            <span class="text-[10px] font-bold text-fg/50">${counts[color]}</span>
        </div>`;
    }).join('');

    // Add imported legend item if data exists
    if (counts['imported'] > 0) {
        const filtered = state.activeFilter === 'imported';
        html += `<div class="legend-dot ${filtered ? 'filtered' : ''} flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/50 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition mt-1 w-full" data-color="imported">
            <i class="fa-solid fa-house text-[10px]"></i>
            <span class="font-semibold">Imported Paste</span>
            <span class="text-[10px] font-bold opacity-70 ml-auto">${counts['imported']}</span>
        </div>`;
    }

    legend.innerHTML = html;
    document.getElementById('total-count').textContent = state.sites.length;
}

export function handleListSearch(e) {
    state.listSearchQuery = e.target.value.toLowerCase().trim();
    renderSiteList();
}

function renderSiteList() {
    const list = document.getElementById('site-list');
    const empty = document.getElementById('empty-state');

    const filtered = state.sites.map((s, i) => ({ ...s, _idx: i }))
        .filter(s => !state.activeFilter || s.color === state.activeFilter)
        .filter(s => !state.listSearchQuery || s.name.toLowerCase().includes(state.listSearchQuery));

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
        const isSelected = state.selectedIdx === site._idx;
        let iconHtml = site.isImported
            ? `<div class="w-4 h-4 rounded flex items-center justify-center bg-[#3b82f6] text-white flex-shrink-0 text-[8px]"><i class="fa-solid fa-house"></i></div>`
            : `<span class="w-3.5 h-3.5 rounded-full flex-shrink-0" style="background:${COLOR_MAP[site.color] || COLOR_MAP.green}; box-shadow:0 0 8px ${COLOR_MAP[site.color] || COLOR_MAP.green}55"></span>`;

        return `<div class="site-item ${isSelected ? 'selected' : ''} flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer" data-idx="${site._idx}">
            ${iconHtml}
            <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold ${site.isImported ? 'text-[#60a5fa]' : 'text-fg'} truncate">${escHtml(site.name)}</div>
            </div>
        </div>`;
    }).join('');

    if (filtered.length > displayLimit) {
        html += `<div class="text-center text-[10px] text-muted py-2 bg-card/50 rounded-lg mt-2 mb-1 border border-dashed border-border">Showing 100 of ${filtered.length}. Use search.</div>`;
    }
    list.innerHTML = html;
}

export function toggleFilter(color) {
    state.activeFilter = state.activeFilter === color ? null : color;
    renderMarkers();
    renderLegend();
    renderSiteList();
    closeDetail();
}

export function fitAll() {
    let bounds = L.latLngBounds();

    if (markersGroup && markersGroup.getLayers().length > 0) {
        bounds.extend(markersGroup.getBounds());
    }
    if (importedGroup && importedGroup.getLayers().length > 0) {
        bounds.extend(importedGroup.getBounds());
    }

    if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8, maxZoom: 14 });
    } else {
        showToast('No sites to fit', 'error');
    }
}
