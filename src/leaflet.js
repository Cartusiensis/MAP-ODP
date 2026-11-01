// leaflet.markercluster is a UMD plugin that patches the global `L`.
// ES modules evaluate imports in order, so leaflet-global.js runs first.
import './leaflet-global.js';
import 'leaflet.markercluster';
import L from 'leaflet';

export default L;
