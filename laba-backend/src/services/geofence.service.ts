import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { LocationRefType } from '@prisma/client';
import { validateGeofenceBoundary, GeofenceResult } from '../utils/haversine';

export interface LocationEnforcement {
  type: LocationRefType;
  refId: string;
  refName: string;
  targetLat?: number;
  targetLng?: number;
  radiusMetres?: number;
  unrestricted: boolean;
}

export class GeofenceService {
  /**
   * Resolves the authorized location boundary for an employee on a given work date.
   * Office Staff -> Must have an active assigned branch.
   * Field Staff -> Resolved via FieldStaffSchedule with strict state checks.
   */
  async resolveLocationEnforcement(
    employeeId: string,
    employeeType: string,
    workDate: Date,
    organizationId: string
  ): Promise<LocationEnforcement> {
    if (employeeType === 'OFFICE_STAFF') {
      const assignment = await prisma.branchAssignment.findFirst({
        where: {
          employeeId,
          isCurrent: true,
          branch: {
            organizationId,
            isActive: true,
          },
        },
        include: {
          branch: true,
        },
      });

      if (!assignment || !assignment.branch) {
        throw new AppError(
          'Office staff must have an active branch assignment to record attendance. Please contact your administrator.',
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
        unrestricted: false,
      };
    }

    if (employeeType === 'FIELD_STAFF') {
      const schedule = await prisma.fieldStaffSchedule.findFirst({
        where: {
          employeeId,
          scheduleDate: workDate,
        },
      });

      if (!schedule) {
        throw new AppError(
          'No field schedule has been configured for you today. Please contact your manager or administrator.',
          403,
          'NO_SCHEDULE_CONFIGURED'
        );
      }

      if (schedule.scheduleType === 'WEEKLY_OFF') {
        throw new AppError(
          'Today is marked as your weekly off. Attendance is not permitted on weekly off days.',
          403,
          'SCHEDULE_WEEKLY_OFF'
        );
      }

      if (schedule.scheduleType === 'ATTENDANCE_DISABLED' || !schedule.attendanceEnabled) {
        throw new AppError(
          'Attendance has been explicitly disabled for you today by an administrator.',
          403,
          'SCHEDULE_ATTENDANCE_DISABLED'
        );
      }

      if (schedule.scheduleType === 'UNASSIGNED') {
        return {
          type: LocationRefType.UNRESTRICTED,
          refId: schedule.id,
          refName: schedule.locationName || 'Field Duty - Unrestricted',
          unrestricted: true,
        };
      }

      if (schedule.scheduleType === 'LOCATION_ASSIGNED') {
        if (schedule.latitude === null || schedule.longitude === null) {
          throw new AppError(
            'Field schedule is configured for location assignment but missing coordinates.',
            400,
            'INVALID_FIELD_SCHEDULE'
          );
        }

        return {
          type: LocationRefType.FIELD_SCHEDULE,
          refId: schedule.id,
          refName: schedule.locationName || 'Field Assigned Duty Location',
          targetLat: Number(schedule.latitude),
          targetLng: Number(schedule.longitude),
          radiusMetres: schedule.geofenceRadiusMetres || 100,
          unrestricted: false,
        };
      }

      throw new AppError('Unknown field staff schedule type.', 400, 'INVALID_SCHEDULE_TYPE');
    }

    // Default administrative users fallback to unrestricted
    return {
      type: LocationRefType.UNRESTRICTED,
      refId: employeeId,
      refName: 'Administrative Attendance',
      unrestricted: true,
    };
  }

  /**
   * Validates GPS coordinates against resolved enforcement rules.
   */
  validateAttendanceLocation(
    enforcement: LocationEnforcement,
    userLat: number,
    userLng: number
  ): GeofenceResult {
    if (enforcement.unrestricted) {
      return {
        insideGeofence: true,
        distanceMetres: 0,
        radiusMetres: 0,
        marginMetres: 0,
      };
    }

    if (enforcement.targetLat === undefined || enforcement.targetLng === undefined || enforcement.radiusMetres === undefined) {
      throw new AppError('Incomplete geofence coordinates for validation.', 500, 'GEOFENCE_CONFIG_ERROR');
    }

    const result = validateGeofenceBoundary(
      userLat,
      userLng,
      enforcement.targetLat,
      enforcement.targetLng,
      enforcement.radiusMetres
    );

    if (!result.insideGeofence) {
      throw new AppError(
        `You are outside your authorized geofence at "${enforcement.refName}". Distance: ${Math.round(result.distanceMetres)}m, Allowed: ${result.radiusMetres}m (exceeded by ${Math.round(result.distanceMetres - result.radiusMetres)}m).`,
        400,
        'GEOFENCE_VIOLATION'
      );
    }

    return result;
  }
}

export const geofenceService = new GeofenceService();
