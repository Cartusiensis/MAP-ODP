/* ============================
   SELECTION & DETAIL PANEL
============================ */
import L from './leaflet.js';
import { map, markersGroup } from './map.js';
import { state } from './state.js';
import { COLOR_MAP } from './config.js';
import { escHtml } from './utils.js';
import { calculateAndDrawRoute, clearRoute } from './routing.js';

function highlightMarker(idx) {
    // Target both dots and houses when clearing active state
    document.querySelectorAll('.marker-dot, .marker-house').forEach(dot => dot.classList.remove('active'));
    const dot = document.getElementById(`marker-dot-${idx}`);
    if (dot) dot.classList.add('active');
}

export function selectSite(idx) {
    state.selectedIdx = idx;
    const site = state.sites[idx];
    const targetMarker = state.markersMap[idx];

    document.querySelectorAll('.site-item').forEach(item => {
        item.classList.remove('selected');
        if (parseInt(item.dataset.idx) === idx) item.classList.add('selected');
    });

    showDetail(site);

    if (state.searchMarker) {
        const start = state.searchMarker.getLatLng();
        const end = L.latLng(site.latitude, site.longitude);

        highlightMarker(idx);
        calculateAndDrawRoute(start, end);
    } else if (targetMarker) {
        if (site.isImported) {
            // Bypass cluster zooming for houses, just fly there directly
            map.flyTo([site.latitude, site.longitude], 18, { duration: 0.6 });
            highlightMarker(idx);
        } else {
            // Standard clustered ODP zooming
            markersGroup.zoomToShowLayer(targetMarker, () => highlightMarker(idx));
        }
    }
}

function showDetail(site) {
    const panel = document.getElementById('detail-panel');
    const bar = document.getElementById('detail-color-bar');
    const content = document.getElementById('detail-content');

    bar.style.background = COLOR_MAP[site.color] || COLOR_MAP.green;

    const skipKeys = new Set(['name','latitude','longitude','color','isImported']);
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

export function closeDetail() {
    document.getElementById('detail-panel').classList.remove('open');
    state.selectedIdx = null;
    document.querySelectorAll('.marker-dot').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.site-item').forEach(i => i.classList.remove('selected'));

    clearRoute();
}

export function panToSelected() {
    const s = state.sites[state.selectedIdx];
    if (state.selectedIdx !== null && s) {
        map.flyTo([s.latitude, s.longitude], 18, { duration: 0.6 });
    }
}
