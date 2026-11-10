import { calculateHaversineDistance, validateGeofenceBoundary, isCoordinateWithinIndia } from '../../src/utils/haversine';

describe('Haversine Formula & Geofencing Utility', () => {
  it('should return 0 metres for identical coordinates', () => {
    const dist = calculateHaversineDistance(14.4674, 78.8241, 14.4674, 78.8241);
    expect(dist).toBe(0);
  });

  it('should accurately calculate distance between Kadapa and Nandyal (~118 km)', () => {
    // Kadapa: (14.4674, 78.8241), Nandyal: (15.4788, 78.4836)
    const dist = calculateHaversineDistance(14.4674, 78.8241, 15.4788, 78.4836);
    expect(dist).toBeGreaterThan(117000);
    expect(dist).toBeLessThan(119500);
  });

  it('should accept points strictly within configured geofence radius', () => {
    // Branch at Kadapa, employee ~44 metres north
    const branchLat = 14.4674;
    const branchLng = 78.8241;
    const empLat = 14.4678;
    const empLng = 78.8241;

    const res = validateGeofenceBoundary(empLat, empLng, branchLat, branchLng, 100);
    expect(res.insideGeofence).toBe(true);
    expect(res.distanceMetres).toBeLessThanOrEqual(100);
    expect(res.marginMetres).toBeGreaterThan(0);
  });

  it('should reject points outside configured geofence radius', () => {
    const branchLat = 14.4674;
    const branchLng = 78.8241;
    // ~222 metres north
    const empLat = 14.4694;
    const empLng = 78.8241;

    const res = validateGeofenceBoundary(empLat, empLng, branchLat, branchLng, 100);
    expect(res.insideGeofence).toBe(false);
    expect(res.distanceMetres).toBeGreaterThan(100);
    expect(res.marginMetres).toBeLessThan(0);
  });

  it('should correctly identify coordinates within India bounding box', () => {
    expect(isCoordinateWithinIndia(14.4674, 78.8241)).toBe(true); // Andhra Pradesh
    expect(isCoordinateWithinIndia(0.0, 0.0)).toBe(false);        // Gulf of Guinea
    expect(isCoordinateWithinIndia(51.5074, -0.1278)).toBe(false); // London
  });
});
