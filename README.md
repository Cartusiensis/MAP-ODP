# POMAKO

Map for viewing and navigating to ODPs, built with Vite, Leaflet, Tailwind and Supabase.

## Setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run dev
```

## Build

```bash
npm run build
```

The static site is written to `dist/`. Deploy that folder, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's environment variables.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/main.js` | Entry point: imports styles, creates the map, binds UI events |
| `src/config.js` | Env config, pole file URLs, status colors |
| `src/state.js` | Shared app state |
| `src/auth.js` | Email OTP login, 24-hour session limit |
| `src/map.js` | Leaflet map, base layers, marker groups |
| `src/sites.js` | Loads ODPs from Supabase, renders markers, legend and list |
| `src/detail.js` | Site selection and detail panel |
| `src/routing.js` | Walking route to the selected ODP |
| `src/search.js` | "Go to Coordinate" pin |
| `src/poles.js` | Utility poles layer from KMZ files |
| `src/measure.js` | Distance and area measuring tool |
| `src/import.js` | Paste-from-spreadsheet import |
