import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { geofenceService } from './geofence.service';
import { faceService } from './face.service';
import { getISTWorkDate, isWithinISTWindow, getISTCurrentMinutes, timeStringToMinutes, istDateTimeFromWorkDate } from '../utils/timeWindows';
import { CheckInInput, CheckOutInput, RequestCorrectionInput, ReviewCorrectionInput } from '../schemas/attendance.schema';
import { AttendanceStatus, CorrectionStatus, EmployeeStatus, AttendancePolicy } from '@prisma/client';

const STAFF_TYPES = ['OFFICE_STAFF', 'FIELD_STAFF'] as const;

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

  /** Face check shared by every attendance action. Returns the match score (or null when disabled). */
  async verifyFace(employeeId: string, policy: AttendancePolicy, face: CheckInInput['face']) {
    if (!policy.faceVerificationRequired) return null;
    return faceService.verify(employeeId, face, policy.faceMatchThreshold);
  }

  private assertOfficeStaff(employeeType: string) {
    if (employeeType === 'FIELD_STAFF') {
      throw new AppError(
        'Field staff mark attendance by checking in at each assigned task location.',
        400,
        'USE_FIELD_TASKS'
      );
    }
    if (employeeType !== 'OFFICE_STAFF') {
      throw new AppError('Only office staff use branch check-in.', 400, 'NOT_OFFICE_STAFF');
    }
  }

  /**
   * Office morning check-in: time window + branch geofence + face verification.
   */
  async checkIn(userId: string, input: CheckInInput, ipAddress?: string, userAgent?: string) {
    const employee = await this.getEmployeeByUserId(userId);
    this.assertOfficeStaff(employee.employeeType);
    const policy = await this.getActivePolicy(employee.organizationId);

    const now = new Date();
    const windowCheck = isWithinISTWindow(policy.morningStart, policy.morningEnd, now);
    if (!windowCheck.inWindow) {
      throw new AppError(
        `Check-in is allowed only between ${policy.morningStart} and ${policy.morningEnd} IST.`,
        400,
        'OUTSIDE_CHECKIN_WINDOW'
      );
    }

    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);

    const workDate = getISTWorkDate(now);
    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (existing) {
      throw new AppError('You have already checked in today.', 409, 'ALREADY_CHECKED_IN');
    }

    const target = await geofenceService.resolveOfficeBranch(employee.id, employee.organizationId);
    const geoResult = geofenceService.assertInside(target, input);
    const faceScore = await this.verifyFace(employee.id, policy, input.face);

    return prisma.$transaction(async (tx) => {
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
          checkInGeofenceValid: true,
          checkInDistanceMetres: geoResult.distanceMetres,
          checkInLocationRefId: target.refId,
          checkInLocationRefType: target.type,
          checkInLocationName: target.refName,
          checkInFaceScore: faceScore,
          checkInSelfie: input.face?.selfie ?? null,
          checkInIsMockLocation: input.isMockLocation ?? null,
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
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            distanceMetres: geoResult.distanceMetres,
            allowedRadius: target.radiusMetres,
            location: target.refName,
            faceScore,
          },
        },
      });

      return { record: this.stripSelfies(record), target, geoResult, faceScore };
    });
  }

  /**
   * Office evening check-out: time window + branch geofence + face + work report.
   */
  async checkOut(userId: string, input: CheckOutInput, ipAddress?: string, userAgent?: string) {
    const employee = await this.getEmployeeByUserId(userId);
    this.assertOfficeStaff(employee.employeeType);
    const policy = await this.getActivePolicy(employee.organizationId);

    const now = new Date();
    const windowCheck = isWithinISTWindow(policy.eveningStart, policy.eveningEnd, now);
    if (!windowCheck.inWindow) {
      throw new AppError(
        `Check-out is allowed only between ${policy.eveningStart} and ${policy.eveningEnd} IST.`,
        400,
        'OUTSIDE_CHECKOUT_WINDOW'
      );
    }

    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);

    const workDate = getISTWorkDate(now);
    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (!existing?.checkInAt) {
      throw new AppError('You cannot check out without checking in this morning.', 400, 'NO_CHECKIN_FOUND');
    }
    if (existing.checkOutAt) {
      throw new AppError('You have already checked out today.', 409, 'ALREADY_CHECKED_OUT');
    }

    const target = await geofenceService.resolveOfficeBranch(employee.id, employee.organizationId);
    const geoResult = geofenceService.assertInside(target, input);
    const faceScore = await this.verifyFace(employee.id, policy, input.face);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: now,
          checkOutLat: input.latitude,
          checkOutLng: input.longitude,
          checkOutAccuracyMetres: input.accuracy,
          checkOutGeofenceValid: true,
          checkOutDistanceMetres: geoResult.distanceMetres,
          checkOutLocationRefId: target.refId,
          checkOutLocationRefType: target.type,
          checkOutLocationName: target.refName,
          checkOutFaceScore: faceScore,
          checkOutSelfie: input.face?.selfie ?? null,
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
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            distanceMetres: geoResult.distanceMetres,
            workReportLength: input.workReport.trim().length,
            faceScore,
          },
        },
      });

      return { record: this.stripSelfies(updated), target, geoResult, faceScore };
    });
  }

  /** Selfies are large; only return them on explicit admin request. */
  stripSelfies<T extends { checkInSelfie?: string | null; checkOutSelfie?: string | null }>(record: T) {
    const { checkInSelfie, checkOutSelfie, ...rest } = record;
    return { ...rest, hasCheckInSelfie: !!checkInSelfie, hasCheckOutSelfie: !!checkOutSelfie };
  }

  /**
   * Today's status for the staff home screen.
   */
  async getTodayStatus(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const policy = await this.getActivePolicy(employee.organizationId);

    const now = new Date();
    const workDate = getISTWorkDate(now);
    const currentMinutes = getISTCurrentMinutes(now);

    const inMorningWindow =
      currentMinutes >= timeStringToMinutes(policy.morningStart) && currentMinutes <= timeStringToMinutes(policy.morningEnd);
    const inEveningWindow =
      currentMinutes >= timeStringToMinutes(policy.eveningStart) && currentMinutes <= timeStringToMinutes(policy.eveningEnd);

    const todayRecord = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });

    let target = null;
    let targetError: string | null = null;
    if (employee.employeeType === 'OFFICE_STAFF') {
      try {
        target = await geofenceService.resolveOfficeBranch(employee.id, employee.organizationId);
      } catch (err: any) {
        targetError = err.message || 'Unable to resolve your branch.';
      }
    }

    const face = await faceService.getStatus(employee.id);

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
        faceVerificationRequired: policy.faceVerificationRequired,
        minReportLength: policy.minReportLength,
      },
      windows: {
        inMorningWindow,
        inEveningWindow,
        canCheckIn: employee.employeeType === 'OFFICE_STAFF' && inMorningWindow && !todayRecord,
        canCheckOut:
          employee.employeeType === 'OFFICE_STAFF' && inEveningWindow && !!todayRecord?.checkInAt && !todayRecord?.checkOutAt,
      },
      todayRecord: todayRecord ? this.stripSelfies(todayRecord) : null,
      target,
      targetError,
      face,
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
      records: records.map((r) => this.stripSelfies(r)),
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
          workDate: input.workDate,
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

      // If approved, apply the proposed times / report to the attendance record
      if (input.status === 'APPROVED') {
        const state = (correction.correctedState as any) || {};
        const workDate = correction.attendanceRecord?.workDate ?? (state.workDate ? new Date(`${state.workDate}T00:00:00.000Z`) : null);
        const proposedIn = workDate && state.proposedCheckIn ? istDateTimeFromWorkDate(workDate, state.proposedCheckIn) : undefined;
        const proposedOut = workDate && state.proposedCheckOut ? istDateTimeFromWorkDate(workDate, state.proposedCheckOut) : undefined;
        const patch = {
          status: AttendanceStatus.CORRECTED,
          isCorrected: true,
          ...(proposedIn ? { checkInAt: proposedIn } : {}),
          ...(proposedOut ? { checkOutAt: proposedOut } : {}),
          ...(state.proposedWorkReport ? { workReport: state.proposedWorkReport } : {}),
        };

        if (correction.attendanceRecordId) {
          await tx.attendanceRecord.update({ where: { id: correction.attendanceRecordId }, data: patch });
        } else if (workDate) {
          const policy = await tx.attendancePolicy.findFirst({
            where: { organizationId: correction.organizationId, isCurrent: true },
          });
          if (!policy) throw new AppError('No active attendance policy.', 500, 'POLICY_NOT_FOUND');
          const created = await tx.attendanceRecord.create({
            data: {
              employeeId: correction.employeeId,
              organizationId: correction.organizationId,
              workDate,
              policyVersionId: policy.id,
              isAdminCreated: true,
              ...patch,
            },
          });
          await tx.attendanceCorrection.update({ where: { id: correctionId }, data: { attendanceRecordId: created.id } });
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
        employeeType: { in: [...STAFF_TYPES] },
        deletedAt: null,
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
      pendingApprovals: await prisma.employee.count({
        where: { organizationId, status: EmployeeStatus.PENDING_APPROVAL, deletedAt: null },
      }),
      pendingLateRequests: await prisma.fieldTask.count({
        where: { organizationId, lateAccessStatus: 'REQUESTED' },
      }),
      recordsSummary: records.slice(0, 10).map((r) => this.stripSelfies(r)),
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
      where: { organizationId, status: EmployeeStatus.ACTIVE, employeeType: { in: [...STAFF_TYPES] }, deletedAt: null },
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
    const todayIST = getISTWorkDate(now);
    const startDate = new Date(todayIST.getTime() - (days - 1) * 86400000);

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
      d.setUTCDate(d.getUTCDate() + i);
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
        (r) => r.checkInGeofenceValid === true
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
        const isToday = r.workDate.toISOString().slice(0, 10) === todayIST.toISOString().slice(0, 10);
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
      (r) => r.checkInGeofenceValid === true
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
