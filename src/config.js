/* ============================
   CONFIG & CONSTANTS
============================ */
// Set these in .env (see .env.example)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const GIS_BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/gis_data`;

export const POLES_FILE_URLS = [
    `${GIS_BUCKET_URL}/TIANG%20STO%20TIMIKA.kmz`,
    `${GIS_BUCKET_URL}/TIANG%20STO%20TEMBAGAPURA.kmz`,
    `${GIS_BUCKET_URL}/TIANG%20STO%20KUALA%20KENCANA.kmz`
];

export const COLOR_MAP = {
    red:    '#EF4444',
    orange: '#F97316',
    yellow: '#EAB308',
    green:  '#22C55E',
    black:  '#475569'
};
export const COLOR_LABELS = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    black: 'Black'
};
