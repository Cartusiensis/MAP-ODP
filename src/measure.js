/* ============================
   MEASURE TOOL LOGIC
============================ */
import { area } from '@turf/area';
import { polygon } from '@turf/helpers';
import L from './leaflet.js';
import { map, measureLayerGroup } from './map.js';
import { state } from './state.js';
import { formatDistance } from './utils.js';

const MEASURE_COLOR = '#F0883E';

let isMeasureToolOpen = false;
let measurePoints = [];
let measureTempLayer = null;
let measureTooltip = null;

export function toggleMeasureTool() {
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

export function setMeasureMode(mode) {
    state.measureMode = mode;
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

export function clearMeasure() {
    measurePoints = [];
    measureLayerGroup.clearLayers();
    clearTempLayers();
    document.getElementById('measure-result').innerText = '0 m';
}

function clearTempLayers() {
    if (measureTempLayer) map.removeLayer(measureTempLayer);
    if (measureTooltip) map.removeLayer(measureTooltip);
    measureTempLayer = null;
    measureTooltip = null;
}

// Redraws the committed points and, optionally, the line/polygon through them
function drawMeasurement(withShape) {
    measureLayerGroup.clearLayers();
    measurePoints.forEach(p => {
        L.circleMarker(p, { radius: 4, color: MEASURE_COLOR, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(measureLayerGroup);
    });
    if (!withShape) return;

    if (state.measureMode === 'distance') {
        L.polyline(measurePoints, { color: MEASURE_COLOR, weight: 4 }).addTo(measureLayerGroup);
    } else if (state.measureMode === 'area') {
        L.polygon(measurePoints, { color: MEASURE_COLOR, weight: 4, fillColor: MEASURE_COLOR, fillOpacity: 0.2 }).addTo(measureLayerGroup);
    }
}

export function handleMeasureClick(e) {
    measurePoints.push(e.latlng);
    drawMeasurement(measurePoints.length > 1);
    updateMeasureMath();
}

export function handleMeasureMove(e) {
    clearTempLayers();

    const tempPoints = [...measurePoints, e.latlng];

    if (state.measureMode === 'distance') {
        measureTempLayer = L.polyline(tempPoints, { color: MEASURE_COLOR, weight: 4, dashArray: '8, 8' }).addTo(map);
    } else if (state.measureMode === 'area') {
        measureTempLayer = L.polygon(tempPoints, { color: MEASURE_COLOR, weight: 4, dashArray: '8, 8', fillColor: MEASURE_COLOR, fillOpacity: 0.2 }).addTo(map);
    }

    measureTooltip = L.tooltip({
        permanent: true, direction: 'right', className: 'measure-tooltip', offset: [15, 0]
    }).setLatLng(e.latlng);

    const resultStr = updateMeasureMath(tempPoints);
    measureTooltip.setContent(resultStr).addTo(map);
}

export function hasMeasurePoints() {
    return measurePoints.length > 0;
}

export function finishMeasure() {
    if (state.measureMode !== 'distance' && state.measureMode !== 'area') return;

    // The double-click that finishes also registered as a click; drop that extra point
    if (measurePoints.length > 0) {
        measurePoints.pop();
    }

    clearTempLayers();
    drawMeasurement(true);
    updateMeasureMath(measurePoints);

    state.measureMode = 'finished';

    document.getElementById('map').classList.remove('measuring-mode');
    document.getElementById('btn-measure-dist').classList.remove('measure-btn-active');
    document.getElementById('btn-measure-area').classList.remove('measure-btn-active');

    setTimeout(() => { map.doubleClickZoom.enable(); }, 300);
}

function updateMeasureMath(pointsArray = measurePoints) {
    if (pointsArray.length < 2) return '0 m';

    let resultStr = '0 m';
    const mode = state.measureMode;

    if (mode === 'distance' || mode === 'finished') {
        let totalMeters = 0;
        for (let i = 0; i < pointsArray.length - 1; i++) {
            totalMeters += pointsArray[i].distanceTo(pointsArray[i+1]);
        }
        resultStr = formatDistance(totalMeters);
    }

    if (mode === 'area' || (mode === 'finished' && pointsArray.length > 2)) {
        if (pointsArray.length < 3) return '0 mÂ²';

        const turfCoords = pointsArray.map(p => [p.lng, p.lat]);
        turfCoords.push([pointsArray[0].lng, pointsArray[0].lat]);

        const areaMeters = area(polygon([turfCoords]));

        if (areaMeters < 10000) {
            resultStr = `${Math.round(areaMeters).toLocaleString()} mÂ²`;
        } else {
            resultStr = `${(areaMeters / 1000000).toFixed(3)} kmÂ²`;
        }
    }

    document.getElementById('measure-result').innerText = resultStr;
    return resultStr;
}
