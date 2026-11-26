/**
 * Boundary geometry helpers (GeoJSON, coordinates are [lng, lat]).
 * Mirrors the server's checks so the app can show a live "inside / X m outside" hint;
 * the server always makes the final decision.
 */
export type LngLat = [number, number];
export type Ring = LngLat[];
export type BoundaryGeometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export interface FenceValue {
  latitude: number;
  longitude: number;
  radiusMetres: number;
  shape: 'CIRCLE' | 'POLYGON';
  boundary: BoundaryGeometry | null;
  boundaryLabel: string | null;
}

export const polygonsOf = (g: BoundaryGeometry): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

export const countVertices = (g: BoundaryGeometry) =>
  polygonsOf(g).reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);

export function isBoundary(g: any): g is BoundaryGeometry {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !Array.isArray(g.coordinates)) return false;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return (
    polys.length > 0 &&
    polys.every(
      (p: any) =>
        Array.isArray(p) &&
        p.length > 0 &&
        p.every((r: any) => Array.isArray(r) && r.length >= 4 && r.every((c: any) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])))
    )
  );
}

function pointInRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInBoundary(lat: number, lng: number, g: BoundaryGeometry) {
  return polygonsOf(g).some(([outer, ...holes]) => pointInRing(lng, lat, outer) && !holes.some((h) => pointInRing(lng, lat, h)));
}

export function distanceToBoundaryMetres(lat: number, lng: number, g: BoundaryGeometry) {
  const kx = ((Math.PI / 180) * 6371000) * Math.cos((lat * Math.PI) / 180);
  const ky = (Math.PI / 180) * 6371000;
  let best = Infinity;
  for (const poly of polygonsOf(g)) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const ax = (ring[i][0] - lng) * kx, ay = (ring[i][1] - lat) * ky;
        const dx = (ring[i + 1][0] - lng) * kx - ax, dy = (ring[i + 1][1] - lat) * ky - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

export function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Live hint for a fence: inside? and how far from the pin / outside the edge. */
export function fenceStatus(
  fence: { shape?: string; boundary?: BoundaryGeometry | null; targetLat?: number; targetLng?: number; latitude?: number; longitude?: number; radiusMetres: number },
  lat: number,
  lng: number
) {
  if (fence.shape === 'POLYGON' && fence.boundary && isBoundary(fence.boundary)) {
    const inside = pointInBoundary(lat, lng, fence.boundary);
    return { inside, distance: inside ? 0 : distanceToBoundaryMetres(lat, lng, fence.boundary), polygon: true };
  }
  const d = haversineMetres(lat, lng, (fence.targetLat ?? fence.latitude)!, (fence.targetLng ?? fence.longitude)!);
  return { inside: d <= fence.radiusMetres, distance: d, polygon: false };
}

/** Leaflet wants [lat, lng]; GeoJSON stores [lng, lat]. */
export const toLatLngs = (g: BoundaryGeometry): [number, number][][][] =>
  polygonsOf(g).map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])));

export function boundaryCenter(g: BoundaryGeometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygonsOf(g)) for (const [x, y] of poly[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { latitude: (minY + maxY) / 2, longitude: (minX + maxX) / 2 };
}

/** Closes a hand-drawn list of [lat, lng] points into a GeoJSON polygon. */
export function polygonFromPoints(points: [number, number][]): BoundaryGeometry | null {
  if (points.length < 3) return null;
  const ring: Ring = points.map(([lat, lng]) => [lng, lat]);
  ring.push([...ring[0]] as LngLat);
  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * Reads a boundary from a GeoJSON or KML file (e.g. exported from Google My Maps or Google Earth).
 * Returns the polygon(s) found, merged into one geometry.
 */
export function parseBoundaryFile(text: string): { boundary: BoundaryGeometry; label: string | null } {
  const trimmed = text.trim();
  const polys: Ring[][] = [];
  let label: string | null = null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = JSON.parse(trimmed);
    const visit = (o: any) => {
      if (!o) return;
      if (o.type === 'FeatureCollection') o.features?.forEach(visit);
      else if (o.type === 'Feature') {
        label = label ?? o.properties?.name ?? null;
        visit(o.geometry);
      } else if (o.type === 'GeometryCollection') o.geometries?.forEach(visit);
      else if (o.type === 'Polygon') polys.push(o.coordinates);
      else if (o.type === 'MultiPolygon') polys.push(...o.coordinates);
    };
    visit(json);
  } else {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('The file is not valid KML or GeoJSON.');
    const readRing = (el: Element | null | undefined): Ring | null => {
      const raw = el?.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (!raw) return null;
      const ring = raw
        .split(/\s+/)
        .map((t) => t.split(',').map(Number))
        .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .map((c) => [c[0], c[1]] as LngLat);
      if (ring.length < 3) return null;
      const [f, l] = [ring[0], ring[ring.length - 1]];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push([...f] as LngLat);
      return ring;
    };
    const placemark = doc.getElementsByTagName('Placemark')[0];
    label = placemark?.getElementsByTagName('name')[0]?.textContent?.trim() || null;
    for (const p of Array.from(doc.getElementsByTagName('Polygon'))) {
      const outer = readRing(p.getElementsByTagName('outerBoundaryIs')[0]);
      if (!outer) continue;
      const holes = Array.from(p.getElementsByTagName('innerBoundaryIs'))
        .map(readRing)
        .filter((r): r is Ring => !!r);
      polys.push([outer, ...holes]);
    }
    // A closed LineString (Google My Maps "line" tool) also works as an outline
    if (polys.length === 0) {
      for (const ls of Array.from(doc.getElementsByTagName('LineString'))) {
        const ring = readRing(ls);
        if (ring && ring.length >= 4) polys.push([ring]);
      }
    }
  }

  if (polys.length === 0) throw new Error('No polygon / boundary outline found in the file.');
  const boundary: BoundaryGeometry = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  if (!isBoundary(boundary)) throw new Error('The boundary in the file is not a valid closed outline.');
  return { boundary, label };
}
