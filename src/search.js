/* ============================
   DROPPED PIN & COORDINATES
   (Go to Coordinate, click-to-pin, right-click for lat/long)
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

const pinIcon = L.divIcon({
    className: 'marker-wrapper',
    html: `<div class="google-red-pin">${googlePinSVG}</div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [-5, -40]
});

const coordPopupOptions = { className: 'coord-popup', closeButton: false, autoPan: false };

function formatLatLng(lat, lng) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function copyCoordinates(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Coordinates copied', 'success');
    } catch {
        showToast('Could not copy. Select the text in the search box instead.', 'error');
    }
}

// Popup body: the coordinates as a button that copies them, like Google Maps
function coordPopupContent(lat, lng) {
    const text = formatLatLng(lat, lng);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Copy coordinates';
    btn.className = 'flex items-center gap-2 whitespace-nowrap font-mono text-[13px] font-semibold text-fg hover:text-accent transition';
    btn.innerHTML = `<i class="fa-regular fa-copy text-xs text-muted"></i><span>${text}</span>`;
    btn.addEventListener('click', () => copyCoordinates(text));
    return btn;
}

// Places the red pin (replacing any previous one). Walking routes start from this pin.
export function dropPin(lat, lng, { fly = false } = {}) {
    if (state.searchMarker) map.removeLayer(state.searchMarker);
    clearRoute();
    closeDetail();

    state.searchMarker = L.marker([lat, lng], { icon: pinIcon })
        .bindPopup(coordPopupContent(lat, lng), coordPopupOptions)
        .addTo(map);

    if (fly) {
        map.flyTo([lat, lng], 18, { duration: 0.8 });
        map.once('moveend', () => state.searchMarker?.openPopup());
    } else {
        state.searchMarker.openPopup();
    }

    document.getElementById('coord-input').value = formatLatLng(lat, lng);
    document.getElementById('clear-pin-btn').classList.remove('hidden');
}

// Right-click (long-press on touch): show the coordinates without moving the pin
export function showCoordinates(latlng) {
    L.popup(coordPopupOptions)
        .setLatLng(latlng)
        .setContent(coordPopupContent(latlng.lat, latlng.lng))
        .openOn(map);
}

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

    dropPin(lat, lng, { fly: true });
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
