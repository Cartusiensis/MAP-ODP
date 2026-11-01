import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';

import { initMap } from './map.js';
import { isMeasuring } from './state.js';
import { toggleSidebar } from './utils.js';
import { handleAuthFlow, handleLogout, restoreSession } from './auth.js';
import { fetchSupabaseData, handleListSearch, toggleFilter, fitAll } from './sites.js';
import { selectSite, closeDetail, panToSelected } from './detail.js';
import { searchCoord, clearSearchPin } from './search.js';
import { togglePolesLayer, checkPolesVisibility } from './poles.js';
import {
    toggleMeasureTool, setMeasureMode, clearMeasure,
    handleMeasureClick, handleMeasureMove, hasMeasurePoints, finishMeasure
} from './measure.js';
import { handleImportToggle, closeImportModal, handleImportPaste, processImport } from './import.js';

const $ = (id) => document.getElementById(id);

function bindMapEvents(map) {
    map.on('click', (e) => {
        if (isMeasuring()) handleMeasureClick(e);
        else closeDetail();
    });

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
    $('coord-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchCoord(); });
    $('btn-search-coord').addEventListener('click', searchCoord);
    $('clear-pin-btn').addEventListener('click', clearSearchPin);
    $('poles-toggle').addEventListener('click', togglePolesLayer);
    $('list-search-input').addEventListener('input', handleListSearch);
    $('btn-refresh').addEventListener('click', fetchSupabaseData);
    $('btn-measure').addEventListener('click', toggleMeasureTool);
    $('btn-fit').addEventListener('click', fitAll);

    // Legend and site list are re-rendered often, so delegate clicks to their containers
    $('legend').addEventListener('click', (e) => {
        const item = e.target.closest('[data-color]');
        if (item) toggleFilter(item.dataset.color);
    });
    $('site-list').addEventListener('click', (e) => {
        const item = e.target.closest('.site-item');
        if (item) selectSite(parseInt(item.dataset.idx));
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
    $('btn-import-process').addEventListener('click', processImport);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMeasuring()) finishMeasure();
    });
}

bindMapEvents(initMap());
bindUiEvents();
restoreSession();
