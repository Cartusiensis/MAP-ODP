import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';

import { initMap } from './map.js';
import { isMeasuring } from './state.js';
import { toggleSidebar, closeSidebar } from './utils.js';
import { handleAuthFlow, handleLogout, restoreSession } from './auth.js';
import { fetchSupabaseData, handleListSearch, toggleFilter, fitAll } from './sites.js';
import { selectSite, closeDetail, panToSelected } from './detail.js';
import { searchCoord, clearSearchPin, dropPin, showCoordinates } from './search.js';
import { togglePolesLayer, checkPolesVisibility } from './poles.js';
import {
    toggleMeasureTool, setMeasureMode, clearMeasure,
    handleMeasureClick, handleMeasureMove, hasMeasurePoints, finishMeasure
} from './measure.js';
import { handleImportToggle, closeImportModal, handleImportPaste, processImport } from './import.js';

const $ = (id) => document.getElementById(id);

// Runs an action, then hides the mobile sidebar so its result on the map is visible
const thenCloseSidebar = (fn) => (...args) => { fn(...args); closeSidebar(); };

function bindMapEvents(map) {
    // Like Google Maps: click drops a pin, right-click / long-press shows the coordinates
    map.on('click', (e) => {
        if (isMeasuring()) handleMeasureClick(e);
        else dropPin(e.latlng.lat, e.latlng.lng);
    });

    map.on('contextmenu', (e) => showCoordinates(e.latlng));

    map.on('mousemove', (e) => {
        if (isMeasuring() && hasMeasurePoints()) handleMeasureMove(e);
    });

    map.on('dblclick', () => {
        if (isMeasuring()) finishMeasure();
    });

    map.on('zoomend', checkPolesVisibility);
}

function bindUiEvents() {
    // Auth
    $('login-form').addEventListener('submit', handleAuthFlow);
    $('btn-logout').addEventListener('click', handleLogout);

    // Sidebar
    $('mobile-menu-btn').addEventListener('click', toggleSidebar);
    $('sidebar-overlay').addEventListener('click', toggleSidebar);
    $('coord-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchCoord();
            closeSidebar();
            e.target.blur(); // dismiss the on-screen keyboard
        }
    });
    $('btn-search-coord').addEventListener('click', thenCloseSidebar(searchCoord));
    $('clear-pin-btn').addEventListener('click', clearSearchPin);
    $('poles-toggle').addEventListener('click', togglePolesLayer);
    $('list-search-input').addEventListener('input', handleListSearch);
    $('btn-refresh').addEventListener('click', fetchSupabaseData);
    $('btn-measure').addEventListener('click', thenCloseSidebar(toggleMeasureTool));
    $('btn-fit').addEventListener('click', thenCloseSidebar(fitAll));

    // Legend and site list are re-rendered often, so delegate clicks to their containers
    $('legend').addEventListener('click', (e) => {
        const item = e.target.closest('[data-color]');
        if (item) toggleFilter(item.dataset.color);
    });
    $('site-list').addEventListener('click', (e) => {
        const item = e.target.closest('.site-item');
        if (!item) return;
        selectSite(parseInt(item.dataset.idx));
        closeSidebar();
    });

    // Measure toolbar
    $('btn-measure-dist').addEventListener('click', () => setMeasureMode('distance'));
    $('btn-measure-area').addEventListener('click', () => setMeasureMode('area'));
    $('btn-measure-clear').addEventListener('click', clearMeasure);
    $('btn-measure-close').addEventListener('click', toggleMeasureTool);

    // Detail panel
    $('btn-detail-close').addEventListener('click', closeDetail);
    $('btn-zoom-selected').addEventListener('click', panToSelected);

    // Import
    $('btn-import-toggle').addEventListener('click', handleImportToggle);
    $('import-textarea').addEventListener('input', handleImportPaste);
    document.querySelectorAll('[data-action="close-import"]').forEach(btn => btn.addEventListener('click', closeImportModal));
    $('btn-import-process').addEventListener('click', thenCloseSidebar(processImport));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMeasuring()) finishMeasure();
    });
}

bindMapEvents(initMap());
bindUiEvents();
restoreSession();
