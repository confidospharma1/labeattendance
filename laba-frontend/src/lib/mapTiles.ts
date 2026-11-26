/**
 * Free map tiles (no API key). Satellite imagery is Esri World Imagery with Esri's
 * boundaries & place-name overlay, which gives the same "satellite + labels" look as
 * Google's hybrid map. Streets are OpenStreetMap.
 */
export const TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Labels &copy; Esri',
    maxZoom: 19,
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
} as const;

export type MapLayer = 'satellite' | 'streets';

/** Google-Maps-like boundary outline: red dashed line with a light fill. */
export const BOUNDARY_STYLE = { color: '#DC2626', weight: 2.5, dashArray: '6 5', fillColor: '#DC2626', fillOpacity: 0.06 };
export const CIRCLE_STYLE = { color: '#2563EB', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.15 };
export const TERRITORY_STYLE = { color: '#7C3AED', weight: 2.5, dashArray: '6 5', fillColor: '#7C3AED', fillOpacity: 0.07 };
