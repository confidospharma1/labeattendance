import { geofenceService } from '../../src/services/geofence.service';

describe('GeofenceService - Unit logic', () => {
  it('should accept check-in when user is unrestricted', () => {
    const result = geofenceService.validateAttendanceLocation(
      {
        type: 'UNRESTRICTED' as any,
        refId: 'test-unrestricted',
        refName: 'Field Unrestricted',
        unrestricted: true,
      },
      14.4673,
      78.8242
    );

    expect(result.insideGeofence).toBe(true);
    expect(result.distanceMetres).toBe(0);
  });

  it('should approve location within geofence radius', () => {
    const kadapaBranchLat = 14.4673;
    const kadapaBranchLng = 78.8242;

    // A coordinate ~20 meters away
    const userLat = 14.46745;
    const userLng = 78.8242;

    const result = geofenceService.validateAttendanceLocation(
      {
        type: 'BRANCH' as any,
        refId: 'branch-1',
        refName: 'Kadapa Branch',
        targetLat: kadapaBranchLat,
        targetLng: kadapaBranchLng,
        radiusMetres: 100,
        unrestricted: false,
      },
      userLat,
      userLng
    );

    expect(result.insideGeofence).toBe(true);
    expect(result.distanceMetres).toBeLessThan(100);
  });

  it('should throw GEOFENCE_VIOLATION when user is outside radius', () => {
    const kadapaBranchLat = 14.4673;
    const kadapaBranchLng = 78.8242;

    // Nandyal is ~118km away
    const nandyalLat = 15.4883;
    const nandyalLng = 78.4842;

    expect(() => {
      geofenceService.validateAttendanceLocation(
        {
          type: 'BRANCH' as any,
          refId: 'branch-1',
          refName: 'Kadapa Branch',
          targetLat: kadapaBranchLat,
          targetLng: kadapaBranchLng,
          radiusMetres: 100,
          unrestricted: false,
        },
        nandyalLat,
        nandyalLng
      );
    }).toThrow(/outside your authorized geofence/);
  });
});

