import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { GeofenceShape, LocationRefType, Prisma } from '@prisma/client';
import { calculateHaversineDistance } from '../utils/haversine';
import { BoundaryGeometry, distanceToBoundaryMetres, isValidBoundary, pointInBoundary } from '../utils/geo';
import { GpsProof } from '../schemas/proof.schema';

export interface GeofenceTarget {
  type: LocationRefType;
  refId: string;
  refName: string;
  targetLat: number;
  targetLng: number;
  radiusMetres: number;
  shape: GeofenceShape;
  boundary: BoundaryGeometry | null;
  boundaryLabel: string | null;
}

export interface GeofenceCheck {
  insideGeofence: boolean;
  shape: GeofenceShape;
  /** Circle: distance from the pin. Polygon: 0 inside, otherwise distance outside the boundary edge. */
  distanceMetres: number;
  radiusMetres: number;
  marginMetres: number;
}

/** Anything stored with a pin + optional exact boundary (Branch, FieldTask, Camp). */
interface FenceRow {
  id: string;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  geofenceShape: GeofenceShape;
  boundary: Prisma.JsonValue | null;
  boundaryLabel: string | null;
}

/** Builds a target from a stored row. A POLYGON row with a broken boundary falls back to its radius. */
export function targetFromRow(row: FenceRow, type: LocationRefType, name: string, radiusMetres: number): GeofenceTarget {
  const boundary = row.geofenceShape === 'POLYGON' && isValidBoundary(row.boundary) ? row.boundary : null;
  return {
    type,
    refId: row.id,
    refName: name,
    targetLat: Number(row.latitude),
    targetLng: Number(row.longitude),
    radiusMetres,
    shape: boundary ? 'POLYGON' : 'CIRCLE',
    boundary,
    boundaryLabel: boundary ? row.boundaryLabel : null,
  };
}

export class GeofenceService {
  private async currentBranch(employeeId: string, organizationId: string) {
    const assignment = await prisma.branchAssignment.findFirst({
      where: { employeeId, isCurrent: true, branch: { organizationId, isActive: true } },
      include: { branch: true },
    });
    return assignment?.branch ?? null;
  }

  /** Office / DC / pharmacy / lab staff: their assigned location's geofence (radius or exact boundary). */
  async resolveOfficeBranch(employeeId: string, organizationId: string): Promise<GeofenceTarget> {
    const branch = await this.currentBranch(employeeId, organizationId);
    if (!branch) {
      throw new AppError(
        'You are not assigned to an active work location. Please contact your administrator.',
        403,
        'NO_BRANCH_ASSIGNED'
      );
    }
    return targetFromRow(branch, LocationRefType.BRANCH, branch.name, branch.geofenceRadiusMetres);
  }

  /** Sales executive: anywhere inside the allotted distribution centre's territory map. */
  async resolveTerritory(employeeId: string, organizationId: string): Promise<GeofenceTarget> {
    const dc = await this.currentBranch(employeeId, organizationId);
    if (!dc) {
      throw new AppError(
        'You are not allotted to a distribution centre. Please contact your administrator.',
        403,
        'NO_BRANCH_ASSIGNED'
      );
    }
    if (isValidBoundary(dc.territory)) {
      return {
        type: LocationRefType.TERRITORY,
        refId: dc.id,
        refName: dc.territoryLabel ? `${dc.name} territory (${dc.territoryLabel})` : `${dc.name} territory`,
        targetLat: Number(dc.latitude),
        targetLng: Number(dc.longitude),
        radiusMetres: dc.geofenceRadiusMetres,
        shape: 'POLYGON',
        boundary: dc.territory,
        boundaryLabel: dc.territoryLabel,
      };
    }
    // No territory drawn yet: fall back to the DC's own geofence.
    return targetFromRow(dc, LocationRefType.TERRITORY, dc.name, dc.geofenceRadiusMetres);
  }

  /** Rejects fixes that are too inaccurate or come from a mock-location app. */
  assertGpsQuality(gps: GpsProof, rejectAccuracyMetres: number) {
    if (gps.isMockLocation) {
      throw new AppError(
        'A fake / mock location app was detected. Turn it off to mark attendance.',
        400,
        'MOCK_LOCATION_DETECTED'
      );
    }
    if (gps.accuracy > rejectAccuracyMetres) {
      throw new AppError(
        `GPS accuracy is ±${Math.round(gps.accuracy)}m, but must be within ±${rejectAccuracyMetres}m. Move to an open area and try again.`,
        400,
        'POOR_GPS_ACCURACY'
      );
    }
  }

  check(target: GeofenceTarget, gps: Pick<GpsProof, 'latitude' | 'longitude'>): GeofenceCheck {
    if (target.shape === 'POLYGON' && target.boundary) {
      const inside = pointInBoundary(gps.latitude, gps.longitude, target.boundary);
      const edge = distanceToBoundaryMetres(gps.latitude, gps.longitude, target.boundary);
      return {
        insideGeofence: inside,
        shape: 'POLYGON',
        distanceMetres: inside ? 0 : edge,
        radiusMetres: target.radiusMetres,
        marginMetres: inside ? edge : -edge,
      };
    }
    const distance = calculateHaversineDistance(gps.latitude, gps.longitude, target.targetLat, target.targetLng);
    return {
      insideGeofence: distance <= target.radiusMetres,
      shape: 'CIRCLE',
      distanceMetres: distance,
      radiusMetres: target.radiusMetres,
      marginMetres: Math.round((target.radiusMetres - distance) * 100) / 100,
    };
  }

  /** Throws unless the fix is inside the target geofence. */
  assertInside(target: GeofenceTarget, gps: Pick<GpsProof, 'latitude' | 'longitude'>): GeofenceCheck {
    const result = this.check(target, gps);
    if (!result.insideGeofence) {
      const message =
        result.shape === 'POLYGON'
          ? `You are ${Math.round(result.distanceMetres)}m outside the "${target.boundaryLabel || target.refName}" boundary. Move inside the boundary to continue.`
          : `You are ${Math.round(result.distanceMetres)}m from "${target.refName}". You must be within ${target.radiusMetres}m.`;
      throw new AppError(message, 400, 'GEOFENCE_VIOLATION');
    }
    return result;
  }
}

export const geofenceService = new GeofenceService();
