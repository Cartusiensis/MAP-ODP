/* ============================
   SHARED APP STATE
============================ */
export const state = {
    dbSites: [],        // Holds Supabase data
    importedSites: [],  // Holds pasted spreadsheet data
    sites: [],          // Combined array for the map to read
    markersMap: {},     // site index -> Leaflet marker

    selectedIdx: null,
    activeFilter: null,
    listSearchQuery: '',
    searchMarker: null, // Pin dropped via "Go to Coordinate"; routes start here

    // 'none' | 'distance' | 'area' | 'finished'
    measureMode: 'none',
};

export function isMeasuring() {
    return state.measureMode === 'distance' || state.measureMode === 'area';
}
