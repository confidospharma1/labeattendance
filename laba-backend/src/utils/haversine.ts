export const EARTH_RADIUS_METRES = 6371000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceResult {
  insideGeofence: boolean;
  distanceMetres: number;
  radiusMetres: number;
  marginMetres: number; // positive = inside, negative = outside
}

/**
 * Calculates the great-circle distance between two points on a sphere using the Haversine formula.
 * @param lat1 Latitude of first point in decimal degrees
 * @param lon1 Longitude of first point in decimal degrees
 * @param lat2 Latitude of second point in decimal degrees
 * @param lon2 Longitude of second point in decimal degrees
 * @returns Distance in metres
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METRES * c * 100) / 100; // Round to 2 decimal places
}

/**
 * Validates whether reported coordinates fall within an authorized target location and radius.
 */
export function validateGeofenceBoundary(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusMetres: number
): GeofenceResult {
  const distance = calculateHaversineDistance(userLat, userLng, targetLat, targetLng);
  const inside = distance <= radiusMetres;
  const margin = Math.round((radiusMetres - distance) * 100) / 100;

  return {
    insideGeofence: inside,
    distanceMetres: distance,
    radiusMetres,
    marginMetres: margin,
  };
}

/**
 * Basic bounding box validation for geographic coordinates in India.
 * Latitude: ~6.0° to 38.0° N
 * Longitude: ~68.0° to 98.0° E
 */
export function isCoordinateWithinIndia(lat: number, lng: number): boolean {
  return lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;
}

/**
 * Ray-casting algorithm to test whether a coordinate point lies inside an exact boundary polygon.
 * @param pointLat Latitude of point
 * @param pointLng Longitude of point
 * @param polygon Array of [lat, lng] vertices representing the boundary polygon
 */
export function isPointInPolygon(
  pointLat: number,
  pointLng: number,
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > pointLng !== yj > pointLng &&
      pointLat < ((xj - xi) * (pointLng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}


