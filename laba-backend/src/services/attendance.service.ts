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

  /**
   * Admin direct update of an attendance record with full audit trail.
   */
  async updateAttendanceRecord(
    adminUserId: string,
    organizationId: string,
    recordId: string,
    data: {
      status?: AttendanceStatus;
      checkInAt?: string;
      checkOutAt?: string;
      workReport?: string;
      checkInLocationName?: string;
      checkOutLocationName?: string;
      notes?: string;
    }
  ) {
    const existing = await prisma.attendanceRecord.findFirst({
      where: { id: recordId, organizationId },
      include: { employee: true },
    });

    if (!existing) {
      throw new AppError('Attendance record not found.', 404, 'NOT_FOUND');
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.checkInAt !== undefined && { checkInAt: data.checkInAt ? new Date(data.checkInAt) : null }),
        ...(data.checkOutAt !== undefined && { checkOutAt: data.checkOutAt ? new Date(data.checkOutAt) : null }),
        ...(data.workReport !== undefined && { workReport: data.workReport }),
        ...(data.checkInLocationName !== undefined && { checkInLocationName: data.checkInLocationName }),
        ...(data.checkOutLocationName !== undefined && { checkOutLocationName: data.checkOutLocationName }),
        isCorrected: true,
        isAdminCreated: true,
      },
      include: { employee: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'ATTENDANCE_ADMIN_MODIFIED',
        entityType: 'attendance_records',
        entityId: recordId,
        beforeState: {
          status: existing.status,
          checkInAt: existing.checkInAt,
          checkOutAt: existing.checkOutAt,
          workReport: existing.workReport,
        },
        afterState: {
          status: updated.status,
          checkInAt: updated.checkInAt,
          checkOutAt: updated.checkOutAt,
          workReport: updated.workReport,
          notes: data.notes,
        },
      },
    });

    return updated;
  }

  /**
   * Admin deletion of an attendance record from entire database.
   */
  async deleteAttendanceRecord(
    adminUserId: string,
    organizationId: string,
    recordId: string
  ) {
    const existing = await prisma.attendanceRecord.findFirst({
      where: { id: recordId, organizationId },
      include: { employee: true },
    });

    if (!existing) {
      throw new AppError('Attendance record not found.', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Delete associated corrections
      await tx.attendanceCorrection.deleteMany({
        where: { attendanceRecordId: recordId },
      });

      // 2. Delete the record
      await tx.attendanceRecord.delete({
        where: { id: recordId },
      });

      // 3. Record audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: adminUserId,
          actorRole: 'ADMIN',
          action: 'ATTENDANCE_RECORD_DELETED',
          entityType: 'attendance_records',
          entityId: recordId,
          beforeState: {
            employeeId: existing.employeeId,
            employeeName: existing.employee.fullName,
            workDate: existing.workDate,
            status: existing.status,
          },
          afterState: { deleted: true },
        },
      });

      return {
        success: true,
        message: `Attendance record for ${existing.employee.fullName} on ${existing.workDate.toISOString().slice(0, 10)} deleted.`,
      };
    });
  }

  /**
   * Comprehensive Analytics Aggregation for Admin & Super Admin.
   */
  async getAnalytics(organizationId: string, days = 7) {
    const totalActiveEmployees = await prisma.employee.count({
      where: { organizationId, status: EmployeeStatus.ACTIVE },
    });

    const branches = await prisma.branch.findMany({
      where: { organizationId, isActive: true },
      include: {
        assignments: {
          where: { isCurrent: true },
          include: { employee: true },
        },
      },
    });

    // Determine date range in IST
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        workDate: {
          gte: startDate,
        },
      },
      include: {
        employee: {
          include: {
            branchAssignments: {
              where: { isCurrent: true },
              include: { branch: true },
            },
          },
        },
      },
      orderBy: { workDate: 'asc' },
    });

    // Group records by day
    const dayMap = new Map<string, typeof records>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, []);
    }

    for (const rec of records) {
      const key = rec.workDate.toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        dayMap.get(key)!.push(rec);
      }
    }

    const trends = Array.from(dayMap.entries()).map(([dateStr, dayRecords]) => {
      const d = new Date(dateStr);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayOfWeek = dayNames[d.getUTCDay()];

      const officePresent = dayRecords.filter(
        (r) => r.employee.employeeType === 'OFFICE_STAFF' && r.status !== AttendanceStatus.ABSENT
      ).length;
      const fieldPresent = dayRecords.filter(
        (r) => r.employee.employeeType === 'FIELD_STAFF' && r.status !== AttendanceStatus.ABSENT
      ).length;
      const totalPresent = officePresent + fieldPresent;
      const reportCount = dayRecords.filter((r) => !!r.workReport).length;
      const geofenceValidCount = dayRecords.filter(
        (r) => r.checkInGeofenceValid === true || r.checkInLocationRefType === 'UNRESTRICTED'
      ).length;

      const rate = totalActiveEmployees > 0 ? Math.round((totalPresent / totalActiveEmployees) * 100) : 0;

      return {
        date: dateStr,
        dayOfWeek,
        totalPresent,
        officePresent,
        fieldPresent,
        absentCount: Math.max(0, totalActiveEmployees - totalPresent),
        reportCount,
        geofenceValidCount,
        rate,
      };
    });

    // Branch Performance Breakdown
    const branchPerformance = branches.map((b) => {
      const branchStaffCount = b.assignments.length;
      const branchStaffIds = new Set(b.assignments.map((a) => a.employeeId));

      const branchRecordsToday = (records || []).filter((r) => {
        const isToday = r.workDate.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
        return isToday && branchStaffIds.has(r.employeeId);
      });

      const presentToday = branchRecordsToday.length;
      const geofenceValidToday = branchRecordsToday.filter(
        (r) => r.checkInGeofenceValid === true
      ).length;

      const attendanceRate = branchStaffCount > 0 ? Math.round((presentToday / branchStaffCount) * 100) : 0;
      const geofenceComplianceRate = presentToday > 0 ? Math.round((geofenceValidToday / presentToday) * 100) : 100;

      return {
        id: b.id,
        name: b.name,
        branchCode: b.branchCode,
        district: b.district,
        totalStaff: branchStaffCount,
        presentToday,
        attendanceRate,
        geofenceComplianceRate,
        radiusMetres: b.geofenceRadiusMetres,
      };
    });

    // Aggregate overall KPI metrics
    const totalRecords = records.length;
    const totalWithReports = records.filter((r) => !!r.workReport).length;
    const totalGeofenceValid = records.filter(
      (r) => r.checkInGeofenceValid === true || r.checkInLocationRefType === 'UNRESTRICTED'
    ).length;

    const avgRate =
      trends.length > 0 ? Math.round(trends.reduce((acc, t) => acc + t.rate, 0) / trends.length) : 0;
    const reportRate = totalRecords > 0 ? Math.round((totalWithReports / totalRecords) * 100) : 0;
    const geofenceRate = totalRecords > 0 ? Math.round((totalGeofenceValid / totalRecords) * 100) : 100;

    return {
      timeframeDays: days,
      totalActiveEmployees,
      kpis: {
        overallAttendanceRate: avgRate,
        workReportCompletionRate: reportRate,
        geofenceComplianceRate: geofenceRate,
        totalAttendanceEntries: totalRecords,
      },
      trends,
      branchPerformance,
    };
  }
}

export const attendanceService = new AttendanceService();
