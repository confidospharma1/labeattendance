/**
 * Administrative boundary lookup (city / town / village / mandal / district outlines) from
 * OpenStreetMap Nominatim — free, no API key. These are the same kind of boundaries Google Maps
 * draws as a dotted red outline when you search a place.
 *
 * Nominatim usage policy: max 1 request/second and an identifying User-Agent; results are cached.
 */
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { BoundaryGeometry, boundaryCenter, countVertices, isValidBoundary } from '../utils/geo';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LABE-Attendance/1.0 (geofence boundary lookup)';
const CACHE_TTL_MS = 24 * 3600_000;
// ~5 m tolerance: keeps city outlines to a few hundred points without visibly changing them
const POLYGON_THRESHOLD = 0.00005;

export interface BoundaryResult {
  id: string;
  name: string;
  displayName: string;
  kind: string;
  center: { latitude: number; longitude: number };
  vertexCount: number;
  boundary: BoundaryGeometry;
  /** Set when the area was found because it contains the searched place. */
  note?: string;
}

const cache = new Map<string, { at: number; value: BoundaryResult[] }>();
let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Serialises upstream calls to respect the 1 req/s policy. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function fetchJson(url: string): Promise<any> {
  return throttled(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } });
    if (!res.ok) throw new AppError(`Map boundary service returned ${res.status}. Try again in a moment.`, 502, 'BOUNDARY_LOOKUP_FAILED');
    return res.json();
  });
}

// Roads, rails and rivers can come back as areas; they are never useful geofences.
const SKIP_CLASSES = new Set(['highway', 'railway', 'waterway', 'power']);

function toResult(item: any): BoundaryResult | null {
  if (SKIP_CLASSES.has(item?.category ?? item?.class)) return null;
  const geo = item?.geojson;
  if (!geo || (geo.type !== 'Polygon' && geo.type !== 'MultiPolygon') || !isValidBoundary(geo)) return null;
  const boundary = { type: geo.type, coordinates: geo.coordinates } as BoundaryGeometry;
  return {
    id: `${item.osm_type}/${item.osm_id}`,
    name: item.name || String(item.display_name || '').split(',')[0],
    displayName: item.display_name,
    kind: item.addresstype || item.type || item.class || 'area',
    center: boundaryCenter(boundary),
    vertexCount: countVertices(boundary),
    boundary,
  };
}

async function cached(key: string, load: () => Promise<BoundaryResult[]>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return value;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn('Boundary lookup failed', { error: (err as Error).message });
    throw new AppError('Could not reach the map boundary service. Check the server internet connection.', 502, 'BOUNDARY_LOOKUP_FAILED');
  }
}

const params = (extra: Record<string, string>) =>
  new URLSearchParams({ format: 'jsonv2', polygon_geojson: '1', polygon_threshold: String(POLYGON_THRESHOLD), ...extra });

export const boundaryService = {
  /** Areas matching a place name, e.g. "Kadapa", "Nagarajupeta", "Guntur district". Only results with an outline are returned. */
  search(query: string) {
    const q = query.trim();
    return cached(`s:${q.toLowerCase()}`, async () => {
      const data = await fetchJson(`${NOMINATIM}/search?${params({ q, countrycodes: 'in', limit: '10' })}`);
      const items: any[] = Array.isArray(data) ? data : [];
      const seen = new Set<string>();
      const results = items
        .map(toResult)
        .filter((r): r is BoundaryResult => !!r && !seen.has(r.id) && !!seen.add(r.id));

      // Many towns / localities are mapped as a point without an outline. Offer the areas that
      // contain the best point match instead (e.g. "Tirupati" -> Tirupati Urban Mandal, district).
      const point = items.find((i) => i?.geojson?.type === 'Point' && i.category === 'place');
      if (point && results.length < 3) {
        for (const area of await this.at(Number(point.lat), Number(point.lon))) {
          if (seen.has(area.id)) continue;
          seen.add(area.id);
          results.push({ ...area, note: `contains ${point.name || q}` });
        }
      }
      return results;
    });
  },

  /** Areas containing a map point, from the neighbourhood up to the district. */
  at(latitude: number, longitude: number) {
    const key = `a:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    return cached(key, async () => {
      // Nominatim reverse zoom: 8 = district, 10 = city, 12 = town/mandal, 14 = suburb/village, 16 = neighbourhood
      const results: BoundaryResult[] = [];
      const seen = new Set<string>();
      for (const zoom of [16, 14, 12, 10, 8]) {
        const item = await fetchJson(
          `${NOMINATIM}/reverse?${params({ lat: String(latitude), lon: String(longitude), zoom: String(zoom) })}`
        );
        const r = toResult(item);
        if (r && !seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
      return results;
    });
  },
};
