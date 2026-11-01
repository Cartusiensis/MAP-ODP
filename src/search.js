/* ============================
   GO TO COORDINATE (SEARCH PIN)
============================ */
import L from './leaflet.js';
import { map } from './map.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import { closeDetail } from './detail.js';
import { clearRoute } from './routing.js';

const googlePinSVG = `
    <svg viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 54 20 54C20 54 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#EA4335" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="20" cy="20" r="7" fill="#7A1810"/>
    </svg>`;

export function searchCoord() {
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

    if (state.searchMarker) map.removeLayer(state.searchMarker);
    clearRoute();
    closeDetail();

    const icon = L.divIcon({
        className: 'marker-wrapper',
        html: `<div class="google-red-pin">${googlePinSVG}</div>`,
        iconSize: [36, 48],
        iconAnchor: [18, 48]
    });

    state.searchMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 18, { duration: 0.8 });

    document.getElementById('clear-pin-btn').classList.remove('hidden');
    showToast(`Pin dropped at ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
}

export function clearSearchPin() {
    if (state.searchMarker) { map.removeLayer(state.searchMarker); state.searchMarker = null; }
    clearRoute();

    const routeContainer = document.getElementById('route-info-container');
    if (routeContainer) routeContainer.innerHTML = '';

    document.getElementById('clear-pin-btn').classList.add('hidden');
    document.getElementById('coord-input').value = '';
    showToast('Search pin and routes cleared', 'info');
}
