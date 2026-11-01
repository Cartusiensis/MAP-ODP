/* ============================
   IMPORT DATA FEATURE
============================ */
import L from './leaflet.js';
import { map } from './map.js';
import { state } from './state.js';
import { showToast, escHtml } from './utils.js';
import { combineAndRender } from './sites.js';

let parsedImportHeaders = [];
let parsedImportData = [];

const IMPORT_BTN_CLASS = "w-full flex items-center justify-center gap-2 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6] rounded-lg py-2 text-xs font-semibold transition mt-1";
const CLEAR_BTN_CLASS = "w-full flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 rounded-lg py-2 text-xs font-semibold transition mt-1";

// The sidebar button opens the modal, or clears the data once something is imported
export function handleImportToggle() {
    if (state.importedSites.length > 0) clearImport();
    else openImportModal();
}

function openImportModal() {
    const overlay = document.getElementById('import-overlay');
    overlay.classList.remove('hidden');
    // slight delay to allow display:block to apply before animating opacity
    setTimeout(() => overlay.classList.remove('opacity-0'), 10);

    // Clear previous
    document.getElementById('import-textarea').value = '';
    document.getElementById('import-step-1').classList.remove('hidden');
    document.getElementById('import-step-2').classList.add('hidden');
    document.getElementById('import-step-2').classList.remove('flex');
}

export function closeImportModal() {
    const overlay = document.getElementById('import-overlay');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

// Fired when the user pastes into the textarea
export function handleImportPaste(e) {
    const rawText = e.target.value.trim();
    if (!rawText) return;

    // Excel/Sheets separates columns with Tabs (\t) and rows with Newlines (\n)
    const rows = rawText.split('\n').filter(r => r.trim() !== '');
    if (rows.length < 2) {
        showToast('Not enough data. Please include headers.', 'error');
        e.target.value = '';
        return;
    }

    parsedImportHeaders = rows[0].split('\t').map(h => h.trim());
    parsedImportData = rows.slice(1).map(row => row.split('\t').map(c => c.trim()));

    // Populate dropdowns
    const options = parsedImportHeaders
        .map((header, index) => `<option value="${index}">${escHtml(header)}</option>`)
        .join('');
    ['import-map-name', 'import-map-lat', 'import-map-lng'].forEach(id => {
        document.getElementById(id).innerHTML = options;
    });

    // Auto-guess columns
    parsedImportHeaders.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower.includes('name') || lower.includes('site') || lower.includes('title')) document.getElementById('import-map-name').value = i;
        if (lower.includes('lat') || lower.includes('y')) document.getElementById('import-map-lat').value = i;
        if (lower.includes('lon') || lower.includes('lng') || lower.includes('x')) document.getElementById('import-map-lng').value = i;
    });

    document.getElementById('import-row-count').innerText = parsedImportData.length;
    document.getElementById('import-step-1').classList.add('hidden');

    document.getElementById('import-step-2').classList.remove('hidden');
    document.getElementById('import-step-2').classList.add('flex');
}

export function processImport() {
    const nameIdx = parseInt(document.getElementById('import-map-name').value);
    const latIdx = parseInt(document.getElementById('import-map-lat').value);
    const lngIdx = parseInt(document.getElementById('import-map-lng').value);

    const newSites = [];

    parsedImportData.forEach(row => {
        const lat = parseFloat(row[latIdx]);
        const lng = parseFloat(row[lngIdx]);
        const name = row[nameIdx];

        if (name && !isNaN(lat) && !isNaN(lng)) {
            // Build object with all metadata
            const siteObj = {
                name: name,
                latitude: lat,
                longitude: lng,
                color: 'imported', // Used by activeFilter
                isImported: true   // Custom flag
            };

            // Add remaining columns as metadata
            parsedImportHeaders.forEach((header, i) => {
                if (i !== nameIdx && i !== latIdx && i !== lngIdx) {
                    siteObj[header] = row[i];
                }
            });

            newSites.push(siteObj);
        }
    });

    if (newSites.length === 0) {
        showToast('No valid coordinates found.', 'error');
        return;
    }

    state.importedSites = newSites;
    combineAndRender();

    // Fit map to imported sites
    const importedBounds = L.latLngBounds(newSites.map(s => [s.latitude, s.longitude]));
    map.flyToBounds(importedBounds, { padding: [60, 60], duration: 0.8, maxZoom: 16 });

    closeImportModal();
    showToast(`Successfully plotted ${newSites.length} locations!`, 'success');

    // Change button to Clear
    const btn = document.getElementById('btn-import-toggle');
    btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> <span>Clear Imported Data</span>`;
    btn.className = CLEAR_BTN_CLASS;
}

function clearImport() {
    state.importedSites = [];
    state.activeFilter = null;
    combineAndRender();

    // Reset button
    const btn = document.getElementById('btn-import-toggle');
    btn.innerHTML = `<i class="fa-solid fa-file-import"></i> <span>Paste Spreadsheet Data</span>`;
    btn.className = IMPORT_BTN_CLASS;

    showToast('Imported data cleared.', 'info');
}
