import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { LocationRefType } from '@prisma/client';
import { validateGeofenceBoundary, GeofenceResult } from '../utils/haversine';
import { GpsProof } from '../schemas/proof.schema';

export interface GeofenceTarget {
  type: LocationRefType;
  refId: string;
  refName: string;
  targetLat: number;
  targetLng: number;
  radiusMetres: number;
}

export class GeofenceService {
  /** Office staff: resolve the employee's currently assigned, active branch. */
  async resolveOfficeBranch(employeeId: string, organizationId: string): Promise<GeofenceTarget> {
    const assignment = await prisma.branchAssignment.findFirst({
      where: { employeeId, isCurrent: true, branch: { organizationId, isActive: true } },
      include: { branch: true },
    });

    if (!assignment?.branch) {
      throw new AppError(
        'You are not assigned to an active branch. Please contact your administrator.',
        403,
        'NO_BRANCH_ASSIGNED'
      );
    }

    return {
      type: LocationRefType.BRANCH,
      refId: assignment.branch.id,
      refName: assignment.branch.name,
      targetLat: Number(assignment.branch.latitude),
      targetLng: Number(assignment.branch.longitude),
      radiusMetres: assignment.branch.geofenceRadiusMetres,
    };
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

  /** Throws unless the fix is within the target radius. */
  assertInside(target: GeofenceTarget, gps: GpsProof): GeofenceResult {
    const result = validateGeofenceBoundary(
      gps.latitude,
      gps.longitude,
      target.targetLat,
      target.targetLng,
      target.radiusMetres
    );

    if (!result.insideGeofence) {
      throw new AppError(
        `You are ${Math.round(result.distanceMetres)}m from "${target.refName}". You must be within ${target.radiusMetres}m.`,
        400,
        'GEOFENCE_VIOLATION'
      );
    }
    return result;
  }
}

export const geofenceService = new GeofenceService();
