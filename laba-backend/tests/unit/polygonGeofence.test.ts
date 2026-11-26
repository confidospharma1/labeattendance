import { geofenceService, GeofenceTarget } from '../../src/services/geofence.service';
import { pointInBoundary, distanceToBoundaryMetres, isValidBoundary, BoundaryGeometry, boundaryCenter } from '../../src/utils/geo';
import { shiftInstants, shiftCheckInOccurrence } from '../../src/utils/timeWindows';
import { attendanceModeFor, roleForCategory } from '../../src/utils/staff';

// ~2 km x 2 km square around Kadapa town centre, with a 200 m square hole in the middle
const square: BoundaryGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [78.81, 14.46],
      [78.83, 14.46],
      [78.83, 14.48],
      [78.81, 14.48],
      [78.81, 14.46],
    ],
    [
      [78.819, 14.469],
      [78.821, 14.469],
      [78.821, 14.471],
      [78.819, 14.471],
      [78.819, 14.469],
    ],
  ],
};

const territory: GeofenceTarget = {
  type: 'TERRITORY' as any,
  refId: 'dc-1',
  refName: 'Kadapa DC territory',
  targetLat: 14.47,
  targetLng: 78.82,
  radiusMetres: 100,
  shape: 'POLYGON',
  boundary: square,
  boundaryLabel: 'Kadapa',
};

describe('Boundary (polygon) geofence', () => {
  it('validates GeoJSON boundaries', () => {
    expect(isValidBoundary(square)).toBe(true);
    expect(isValidBoundary({ type: 'Polygon', coordinates: [[[1, 2], [3, 4]]] })).toBe(false);
    expect(isValidBoundary({ type: 'Point', coordinates: [1, 2] })).toBe(false);
  });

  it('accepts points inside the outline far from the pin (no radius limit)', () => {
    // ~1 km from the centre pin, still inside the boundary
    expect(pointInBoundary(14.476, 78.826, square)).toBe(true);
    expect(geofenceService.assertInside(territory, { latitude: 14.476, longitude: 78.826 }).insideGeofence).toBe(true);
  });

  it('rejects points in a hole and outside, reporting distance to the edge', () => {
    expect(pointInBoundary(14.47, 78.82, square)).toBe(false); // hole
    const outside = { latitude: 14.4845, longitude: 78.82 }; // ~500 m north of the top edge
    expect(pointInBoundary(outside.latitude, outside.longitude, square)).toBe(false);
    const d = distanceToBoundaryMetres(outside.latitude, outside.longitude, square);
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(550);
    expect(() => geofenceService.assertInside(territory, outside)).toThrow(expect.objectContaining({ code: 'GEOFENCE_VIOLATION' }));
  });

  it('supports MultiPolygon boundaries', () => {
    const multi: BoundaryGeometry = { type: 'MultiPolygon', coordinates: [[square.coordinates[0]], [[[79, 15], [79.01, 15], [79.01, 15.01], [79, 15], [79, 15]]]] };
    expect(pointInBoundary(14.465, 78.815, multi)).toBe(true);
    expect(boundaryCenter(square)).toEqual({ latitude: 14.47, longitude: 78.82 });
  });
});

describe('Shift windows (IST)', () => {
  const day = { startTime: '09:00', endTime: '17:00', checkInBeforeMinutes: 30, lateGraceMinutes: 15, checkInAfterMinutes: 60, checkOutBeforeMinutes: 15, checkOutAfterMinutes: 120 };
  const night = { ...day, startTime: '22:00', endTime: '06:00' };
  const ist = (s: string) => new Date(`${s}+05:30`);

  it('opens check-in 30 min early and flags late after grace', () => {
    expect(shiftCheckInOccurrence(day, ist('2026-11-26T08:29:00'))).toBeNull();
    const onTime = shiftCheckInOccurrence(day, ist('2026-11-26T09:10:00'))!;
    expect(onTime.workDate.toISOString().slice(0, 10)).toBe('2026-11-26');
    expect(ist('2026-11-26T09:10:00') > onTime.lateAfter).toBe(false);
    const late = shiftCheckInOccurrence(day, ist('2026-11-26T09:40:00'))!;
    expect(ist('2026-11-26T09:40:00') > late.lateAfter).toBe(true);
    expect(shiftCheckInOccurrence(day, ist('2026-11-26T10:01:00'))).toBeNull();
  });

  it('handles overnight shifts: check-out the next morning belongs to the previous work date', () => {
    const t = shiftInstants(new Date('2026-11-26T00:00:00Z'), night);
    expect(t.overnight).toBe(true);
    expect(t.end.toISOString()).toBe(ist('2026-11-27T06:00:00').toISOString());
    expect(t.checkOutOpen.toISOString()).toBe(ist('2026-11-27T05:45:00').toISOString());
  });

  it('a 00:00 shift check-in at 23:45 belongs to the next work date', () => {
    const midnight = { ...day, startTime: '00:00', endTime: '08:00' };
    const occ = shiftCheckInOccurrence(midnight, ist('2026-11-26T23:45:00'))!;
    expect(occ.workDate.toISOString().slice(0, 10)).toBe('2026-11-27');
  });
});

describe('Staff categories', () => {
  it('maps categories to roles and attendance modes', () => {
    expect(roleForCategory('SALES_EXECUTIVE')).toBe('FIELD_STAFF');
    expect(roleForCategory('LABORATORY')).toBe('OFFICE_STAFF');
    expect(attendanceModeFor('OFFICE_STAFF', 'LEADERSHIP')).toBe('ANYWHERE');
    expect(attendanceModeFor('FIELD_STAFF', 'SALES_EXECUTIVE')).toBe('TERRITORY');
    expect(attendanceModeFor('FIELD_STAFF', 'MARKETING_EXECUTIVE')).toBe('FIELD_TASKS');
    expect(attendanceModeFor('FIELD_STAFF', null)).toBe('FIELD_TASKS');
    expect(attendanceModeFor('OFFICE_STAFF', 'PHARMACY')).toBe('BRANCH');
    expect(attendanceModeFor('OFFICE_STAFF', null)).toBe('BRANCH');
  });
});
