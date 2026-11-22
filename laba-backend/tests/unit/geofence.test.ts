import { geofenceService, GeofenceTarget } from '../../src/services/geofence.service';

const kadapa: GeofenceTarget = {
  type: 'BRANCH' as any,
  refId: 'branch-1',
  refName: 'Kadapa Branch',
  targetLat: 14.4673,
  targetLng: 78.8242,
  radiusMetres: 100,
};

const gps = (latitude: number, longitude: number, accuracy = 10, isMockLocation?: boolean) => ({
  latitude,
  longitude,
  accuracy,
  isMockLocation,
});

describe('GeofenceService', () => {
  it('accepts a fix ~20 m from the branch (radius 100 m)', () => {
    const result = geofenceService.assertInside(kadapa, gps(14.46745, 78.8242));
    expect(result.insideGeofence).toBe(true);
    expect(result.distanceMetres).toBeLessThan(100);
  });

  it('rejects a fix ~150 m away with GEOFENCE_VIOLATION', () => {
    expect(() => geofenceService.assertInside(kadapa, gps(14.4687, 78.8242))).toThrow(
      expect.objectContaining({ code: 'GEOFENCE_VIOLATION' })
    );
  });

  it('respects a tight 30 m radius', () => {
    const tight = { ...kadapa, radiusMetres: 30 };
    expect(() => geofenceService.assertInside(tight, gps(14.46775, 78.8242))).toThrow(); // ~50 m
    expect(geofenceService.assertInside(tight, gps(14.46745, 78.8242)).insideGeofence).toBe(true); // ~17 m
  });

  it('rejects poor GPS accuracy', () => {
    expect(() => geofenceService.assertGpsQuality(gps(14.4673, 78.8242, 350), 200)).toThrow(
      expect.objectContaining({ code: 'POOR_GPS_ACCURACY' })
    );
  });

  it('rejects mock locations', () => {
    expect(() => geofenceService.assertGpsQuality(gps(14.4673, 78.8242, 5, true), 200)).toThrow(
      expect.objectContaining({ code: 'MOCK_LOCATION_DETECTED' })
    );
  });
});
