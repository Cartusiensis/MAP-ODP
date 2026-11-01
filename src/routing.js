/* ============================
   WALKING ROUTE
============================ */
import L from './leaflet.js';
import { map } from './map.js';
import { showToast, formatDistance } from './utils.js';

let routeLayerGroup = null;

export function clearRoute() {
    if (routeLayerGroup) {
        map.removeLayer(routeLayerGroup);
        routeLayerGroup = null;
    }
}

export async function calculateAndDrawRoute(start, end) {
    clearRoute();

    const routeContainer = document.getElementById('route-info-container');
    if (routeContainer) {
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
        if (routeContainer) routeContainer.innerHTML = '';
        showToast('Could not find a walking route.', 'error');
    }
}

function updateRouteUI(distance) {
    const container = document.getElementById('route-info-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-xl p-3 mb-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#3b82f6]/40">
                <i class="fa-solid fa-person-walking text-white text-lg"></i>
            </div>
            <div>
                <div class="text-sm font-bold text-fg">${formatDistance(distance)}</div>
                <div class="text-xs text-muted font-medium">Walking Distance</div>
            </div>
        </div>
    `;
}
