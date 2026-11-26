/**
 * Boundary geofencing on GeoJSON geometry (coordinates are [longitude, latitude]).
 *
 * Boundaries come from OpenStreetMap administrative areas (the same city / village / mandal
 * outlines Google Maps draws as a dotted red line) or are drawn by an admin on the map.
 */
import { z } from 'zod';

export type LngLat = [number, number];
export type Ring = LngLat[];
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Ring[]; // [outer, ...holes]
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Ring[][];
}
export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;

const EARTH_RADIUS_METRES = 6371000;
export const MAX_BOUNDARY_VERTICES = 25000;

const isLngLat = (p: unknown): p is LngLat =>
  Array.isArray(p) &&
  p.length >= 2 &&
  typeof p[0] === 'number' &&
  typeof p[1] === 'number' &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

const isRing = (r: unknown): r is Ring => Array.isArray(r) && r.length >= 4 && r.every(isLngLat);

/** Polygons of a geometry as a uniform list. */
export function polygonsOf(g: BoundaryGeometry): Ring[][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

export function countVertices(g: BoundaryGeometry): number {
  return polygonsOf(g).reduce((n, poly) => n + poly.reduce((m, ring) => m + ring.length, 0), 0);
}

export function isValidBoundary(g: unknown): g is BoundaryGeometry {
  if (!g || typeof g !== 'object') return false;
  const geo = g as { type?: unknown; coordinates?: unknown };
  let polys: unknown[];
  if (geo.type === 'Polygon') polys = [geo.coordinates];
  else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) polys = geo.coordinates;
  else return false;
  if (polys.length === 0) return false;
  const ok = polys.every((poly) => Array.isArray(poly) && poly.length >= 1 && poly.every(isRing));
  return ok && countVertices(g as BoundaryGeometry) <= MAX_BOUNDARY_VERTICES;
}

/** Zod validator for a boundary sent by the admin UI. */
export const boundarySchema = z
  .object({ type: z.enum(['Polygon', 'MultiPolygon']), coordinates: z.array(z.any()) })
  .passthrough()
  .refine(isValidBoundary, {
    message: `Boundary must be a valid GeoJSON Polygon/MultiPolygon with at most ${MAX_BOUNDARY_VERTICES} points`,
  })
  .transform((g) => ({ type: g.type, coordinates: g.coordinates }) as BoundaryGeometry);

/** Ray casting for one ring. */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point lies inside the outer ring of any polygon and outside its holes. */
export function pointInBoundary(lat: number, lng: number, g: BoundaryGeometry): boolean {
  return polygonsOf(g).some(
    ([outer, ...holes]) => pointInRing(lng, lat, outer) && !holes.some((h) => pointInRing(lng, lat, h))
  );
}

/** Shortest distance (metres) from the point to any edge of the boundary. */
export function distanceToBoundaryMetres(lat: number, lng: number, g: BoundaryGeometry): number {
  // Local equirectangular projection centred on the point: accurate to well under 1% at city scale.
  const kx = ((Math.PI / 180) * EARTH_RADIUS_METRES) * Math.cos((lat * Math.PI) / 180);
  const ky = (Math.PI / 180) * EARTH_RADIUS_METRES;
  let best = Infinity;
  for (const poly of polygonsOf(g)) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const ax = (ring[i][0] - lng) * kx;
        const ay = (ring[i][1] - lat) * ky;
        const bx = (ring[i + 1][0] - lng) * kx;
        const by = (ring[i + 1][1] - lat) * ky;
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
        const px = ax + t * dx;
        const py = ay + t * dy;
        const d = Math.sqrt(px * px + py * py);
        if (d < best) best = d;
      }
    }
  }
  return Math.round(best * 100) / 100;
}

/** Centre of the bounding box of the largest polygon (used as the map pin for a boundary). */
export function boundaryCenter(g: BoundaryGeometry): { latitude: number; longitude: number } {
  let largest: Ring = polygonsOf(g)[0][0];
  for (const [outer] of polygonsOf(g)) if (outer.length > largest.length) largest = outer;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of largest) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { latitude: (minY + maxY) / 2, longitude: (minX + maxX) / 2 };
}
