import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { geofenceService } from './geofence.service';
import { getISTWorkDate, isWithinISTWindow, getISTCurrentMinutes, timeStringToMinutes } from '../utils/timeWindows';
import { CheckInInput, CheckOutInput, RequestCorrectionInput, ReviewCorrectionInput } from '../schemas/attendance.schema';
import { AttendanceStatus, CorrectionStatus, EmployeeStatus } from '@prisma/client';

export class AttendanceService {
  /**
   * Helper to fetch active employee profile by User ID.
   */
  async getEmployeeByUserId(userId: string) {
    const employee = await prisma.employee.findUnique({
      where: { userId },
      include: {
        organization: true,
        branchAssignments: {
          where: { isCurrent: true },
          include: { branch: true },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee profile not found for this user account.', 404, 'EMPLOYEE_NOT_FOUND');
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new AppError(`Employee status is ${employee.status}. Attendance not allowed.`, 403, 'EMPLOYEE_INACTIVE');
    }

    return employee;
  }

  /**
   * Helper to get active company attendance policy.
   */
  async getActivePolicy(organizationId: string) {
    const policy = await prisma.attendancePolicy.findFirst({
      where: {
        organizationId,
        isCurrent: true,
      },
    });

    if (!policy) {
      throw new AppError('No active attendance policy configured for this organization.', 500, 'POLICY_NOT_FOUND');
    }

    return policy;
  }

  /**
   * Morning Check-In with Server Time, Policy Window, and Geofence Verification.
   */
  async checkIn(
    userId: string,
    input: CheckInInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const employee = await this.getEmployeeByUserId(userId);
    const policy = await this.getActivePolicy(employee.organizationId);

    // 1. Authoritative Server Time Window Verification
    const now = new Date();
    const windowCheck = isWithinISTWindow(policy.morningStart, policy.morningEnd, now);
    if (!windowCheck.inWindow) {
      throw new AppError(
        `Check-in is permitted only between ${policy.morningStart} and ${policy.morningEnd} IST. (Current IST time is outside this window).`,
        400,
        'OUTSIDE_CHECKIN_WINDOW'
      );
    }

    // 2. GPS Accuracy Verification
    if (input.accuracy > policy.gpsAccuracyRejectMetres) {
      throw new AppError(
        `Reported GPS accuracy (${Math.round(input.accuracy)}m) exceeds allowable threshold (${policy.gpsAccuracyRejectMetres}m). Please stand near an open window or outdoor location.`,
        400,
        'POOR_GPS_ACCURACY'
      );
    }

    // 3. Normalized Work Date (Midnight UTC in IST)
    const workDate = getISTWorkDate(now);

    // 4. Duplicate Check-in Prevention
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
    });

    if (existing) {
      throw new AppError('You have already recorded check-in for today.', 409, 'ALREADY_CHECKED_IN');
    }

    // 5. Geofence and Location Enforcement
    const enforcement = await geofenceService.resolveLocationEnforcement(
      employee.id,
      employee.employeeType,
      workDate,
      employee.organizationId
    );

    const geoResult = geofenceService.validateAttendanceLocation(
      enforcement,
      input.latitude,
      input.longitude
    );

    // 6. Atomic Transaction for Record Creation + Audit Log
    return await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          organizationId: employee.organizationId,
          workDate,
          policyVersionId: policy.id,
          status: AttendanceStatus.CHECKED_IN,
          checkInAt: now,
          checkInLat: input.latitude,
          checkInLng: input.longitude,
          checkInAccuracyMetres: input.accuracy,
          checkInGeofenceValid: geoResult.insideGeofence,
          checkInDistanceMetres: geoResult.distanceMetres,
          checkInLocationRefId: enforcement.refId,
          checkInLocationRefType: enforcement.type,
          checkInLocationName: enforcement.refName,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: employee.organizationId,
          actorId: userId,
          actorRole: employee.employeeType,
          action: 'ATTENDANCE_CHECK_IN',
          entityType: 'AttendanceRecord',
          entityId: record.id,
          afterState: JSON.parse(JSON.stringify(record)),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            distanceMetres: geoResult.distanceMetres,
            allowedRadius: enforcement.radiusMetres,
            location: enforcement.refName,
          },
        },
      });

      return {
        record,
        enforcement,
        geoResult,
      };
    });
  }

  /**
   * Evening Check-Out with Work Report, Server Time, and Geofence Verification.
   */
  async checkOut(
    userId: string,
    input: CheckOutInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const employee = await this.getEmployeeByUserId(userId);
    const policy = await this.getActivePolicy(employee.organizationId);

    // 1. Authoritative Server Time Window Verification
    const now = new Date();
    const windowCheck = isWithinISTWindow(policy.eveningStart, policy.eveningEnd, now);
    if (!windowCheck.inWindow) {
      throw new AppError(
        `Check-out is permitted only between ${policy.eveningStart} and ${policy.eveningEnd} IST. (Current IST time is outside this window).`,
        400,
        'OUTSIDE_CHECKOUT_WINDOW'
      );
    }

    // 2. GPS Accuracy Verification
    if (input.accuracy > policy.gpsAccuracyRejectMetres) {
      throw new AppError(
        `Reported GPS accuracy (${Math.round(input.accuracy)}m) exceeds allowable threshold (${policy.gpsAccuracyRejectMetres}m).`,
        400,
        'POOR_GPS_ACCURACY'
      );
    }

    const workDate = getISTWorkDate(now);

    // 3. Verify Existing Check-in
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
    });

    if (!existing || !existing.checkInAt) {
      throw new AppError(
        'Cannot check out without an active morning check-in record for today.',
        400,
        'NO_CHECKIN_FOUND'
      );
    }

    if (existing.checkOutAt) {
      throw new AppError('You have already recorded check-out for today.', 409, 'ALREADY_CHECKED_OUT');
    }

    // 4. Resolve Evening Geofence Boundary (Dual Snapshot preservation)
    const enforcement = await geofenceService.resolveLocationEnforcement(
      employee.id,
      employee.employeeType,
      workDate,
      employee.organizationId
    );

    const geoResult = geofenceService.validateAttendanceLocation(
      enforcement,
      input.latitude,
      input.longitude
    );

    // 5. Atomic Transaction: Update Record to CHECKED_OUT + Audit Log
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: now,
          checkOutLat: input.latitude,
          checkOutLng: input.longitude,
          checkOutAccuracyMetres: input.accuracy,
          checkOutGeofenceValid: geoResult.insideGeofence,
          checkOutDistanceMetres: geoResult.distanceMetres,
          checkOutLocationRefId: enforcement.refId,
          checkOutLocationRefType: enforcement.type,
          checkOutLocationName: enforcement.refName,
          workReport: input.workReport.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: employee.organizationId,
          actorId: userId,
          actorRole: employee.employeeType,
          action: 'ATTENDANCE_CHECK_OUT',
          entityType: 'AttendanceRecord',
          entityId: updated.id,
          beforeState: JSON.parse(JSON.stringify(existing)),
          afterState: JSON.parse(JSON.stringify(updated)),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            distanceMetres: geoResult.distanceMetres,
            workReportLength: input.workReport.trim().length,
          },
        },
      });

      return {
        record: updated,
        enforcement,
        geoResult,
      };
    });
  }

  /**
   * Get employee's attendance status and time window states for today.
   */
  async getTodayStatus(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const policy = await this.getActivePolicy(employee.organizationId);

    const now = new Date();
    const workDate = getISTWorkDate(now);
    const currentMinutes = getISTCurrentMinutes(now);

    const morningStart = timeStringToMinutes(policy.morningStart);
    const morningEnd = timeStringToMinutes(policy.morningEnd);
    const eveningStart = timeStringToMinutes(policy.eveningStart);
    const eveningEnd = timeStringToMinutes(policy.eveningEnd);

    const inMorningWindow = currentMinutes >= morningStart && currentMinutes <= morningEnd;
    const inEveningWindow = currentMinutes >= eveningStart && currentMinutes <= eveningEnd;

    // Check today's record
    const todayRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
    });

    // Try resolving today's enforcement
    let enforcement = null;
    let enforcementError: string | null = null;

    try {
      enforcement = await geofenceService.resolveLocationEnforcement(
        employee.id,
        employee.employeeType,
        workDate,
        employee.organizationId
      );
    } catch (err: any) {
      enforcementError = err.message || 'Unable to resolve duty location.';
    }

    return {
      serverTime: now.toISOString(),
      workDate: workDate.toISOString(),
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        employeeType: employee.employeeType,
      },
      policy: {
        morningStart: policy.morningStart,
        morningEnd: policy.morningEnd,
        eveningStart: policy.eveningStart,
        eveningEnd: policy.eveningEnd,
        gpsAccuracyRejectMetres: policy.gpsAccuracyRejectMetres,
      },
      windows: {
        inMorningWindow,
        inEveningWindow,
        canCheckIn: inMorningWindow && !todayRecord,
        canCheckOut: inEveningWindow && !!todayRecord?.checkInAt && !todayRecord?.checkOutAt,
      },
      todayRecord,
      enforcement,
      enforcementError,
    };
  }

  /**
   * Get employee's paginated attendance history.
   */
  async getMyHistory(userId: string, page = 1, limit = 20) {
    const employee = await this.getEmployeeByUserId(userId);

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: employee.id },
        orderBy: { workDate: 'desc' },
        skip,
        take: limit,
        include: {
          corrections: true,
        },
      }),
      prisma.attendanceRecord.count({
        where: { employeeId: employee.id },
      }),
    ]);

    return {
      records,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Request attendance correction (for missed check-in/out or location issues).
   */
  async requestCorrection(userId: string, input: RequestCorrectionInput) {
    const employee = await this.getEmployeeByUserId(userId);
    const workDate = new Date(`${input.workDate}T00:00:00.000Z`);

    // Verify record if provided
    let attendanceRecordId = input.attendanceRecordId;
    if (!attendanceRecordId) {
      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate,
          },
        },
      });
      if (existing) {
        attendanceRecordId = existing.id;
      }
    }

    return await prisma.attendanceCorrection.create({
      data: {
        attendanceRecordId: attendanceRecordId || null,
        employeeId: employee.id,
        organizationId: employee.organizationId,
        correctionType: input.correctionType,
        status: CorrectionStatus.PENDING,
        employeeReason: input.employeeReason,
        requestedById: userId,
        correctedState: {
          proposedCheckIn: input.proposedCheckIn,
          proposedCheckOut: input.proposedCheckOut,
          proposedWorkReport: input.proposedWorkReport,
        },
      },
      include: {
        employee: true,
      },
    });
  }

  /**
   * Review correction request (Admin / Super Admin).
   */
  async reviewCorrection(
    adminUserId: string,
    correctionId: string,
    input: ReviewCorrectionInput
  ) {
    const correction = await prisma.attendanceCorrection.findUnique({
      where: { id: correctionId },
      include: { attendanceRecord: true, employee: true },
    });

    if (!correction) {
      throw new AppError('Attendance correction request not found.', 404, 'CORRECTION_NOT_FOUND');
    }

    if (correction.status !== CorrectionStatus.PENDING) {
      throw new AppError(`Correction has already been ${correction.status.toLowerCase()}.`, 400, 'ALREADY_REVIEWED');
    }

    return await prisma.$transaction(async (tx) => {
      const updatedCorrection = await tx.attendanceCorrection.update({
        where: { id: correctionId },
        data: {
          status: input.status,
          adminReason: input.adminReason,
          reviewedById: adminUserId,
          reviewedAt: new Date(),
        },
      });

      // If approved, update or create the attendance record
      if (input.status === 'APPROVED') {
        const state = (correction.correctedState as any) || {};

        if (correction.attendanceRecordId) {
          await tx.attendanceRecord.update({
            where: { id: correction.attendanceRecordId },
            data: {
              status: AttendanceStatus.CORRECTED,
              isCorrected: true,
              ...(state.proposedWorkReport ? { workReport: state.proposedWorkReport } : {}),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: correction.organizationId,
          actorId: adminUserId,
          actorRole: 'ADMIN',
          action: `CORRECTION_${input.status}`,
          entityType: 'AttendanceCorrection',
          entityId: correctionId,
          afterState: JSON.parse(JSON.stringify(updatedCorrection)),
          metadata: { adminReason: input.adminReason },
        },
      });

      return updatedCorrection;
    });
  }

  /**
   * Admin Dashboard Attendance Summary for a date.
   */
  async getDashboardSummary(organizationId: string, dateStr?: string) {
    const now = new Date();
    const workDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : getISTWorkDate(now);
    const policy = await this.getActivePolicy(organizationId);

    const totalActiveEmployees = await prisma.employee.count({
      where: {
        organizationId,
        status: EmployeeStatus.ACTIVE,
      },
    });

    const records = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        workDate,
      },
      include: {
        employee: true,
      },
    });

    const checkedInCount = records.filter((r) => r.status === AttendanceStatus.CHECKED_IN).length;
    const checkedOutCount = records.filter((r) => r.status === AttendanceStatus.CHECKED_OUT).length;
    const correctedCount = records.filter((r) => r.status === AttendanceStatus.CORRECTED).length;

    const presentCount = checkedInCount + checkedOutCount + correctedCount;

    // Absent is calculated if past the morning window (or for past dates)
    const currentMinutes = getISTCurrentMinutes(now);
    const morningEndMinutes = timeStringToMinutes(policy.morningEnd);
    const isPastMorningWindow = dateStr || currentMinutes > morningEndMinutes;

    const absentCount = isPastMorningWindow ? Math.max(0, totalActiveEmployees - presentCount) : 0;

    return {
      workDate: workDate.toISOString(),
      totalActiveEmployees,
      presentCount,
      absentCount,
      checkedInOnlyCount: checkedInCount,
      checkedOutCount,
      correctedCount,
      recordsSummary: records.slice(0, 10),
    };
  }
}

export const attendanceService = new AttendanceService();
