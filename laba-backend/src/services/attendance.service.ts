import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { geofenceService, GeofenceTarget, GeofenceCheck } from './geofence.service';
import { faceService } from './face.service';
import {
  getISTWorkDate,
  isWithinISTWindow,
  timeStringToMinutes,
  istDateTimeFromWorkDate,
  shiftInstants,
  shiftCheckInOccurrence,
  istHHMM,
} from '../utils/timeWindows';
import { CheckInInput, CheckOutInput, RequestCorrectionInput, ReviewCorrectionInput } from '../schemas/attendance.schema';
import {
  AttendanceStatus,
  CorrectionStatus,
  EmployeeStatus,
  AttendancePolicy,
  AttendanceRecord,
  LocationRefType,
  Shift,
} from '@prisma/client';
import { attendanceModeFor, AttendanceMode, CATEGORY_LABEL } from '../utils/staff';

const STAFF_TYPES = ['OFFICE_STAFF', 'FIELD_STAFF'] as const;
const DAY_MS = 86_400_000;

interface WindowInfo {
  from: string;
  to: string;
  open: boolean;
}

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

export class AttendanceService {
  /**
   * Helper to fetch active employee profile by User ID.
   */
  async getEmployeeByUserId(userId: string) {
    const employee = await prisma.employee.findUnique({
      where: { userId },
      include: {
        organization: true,
        shift: true,
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

  // ─── Day planning: which geofence and which time windows apply ────────────

  private activeShift(shift: Shift | null | undefined) {
    return shift && shift.isActive ? shift : null;
  }

  /** The geofence an employee must be inside (null for leadership, who can mark anywhere). */
  async resolveTarget(employeeId: string, organizationId: string, mode: AttendanceMode): Promise<GeofenceTarget | null> {
    if (mode === 'BRANCH') return geofenceService.resolveOfficeBranch(employeeId, organizationId);
    if (mode === 'TERRITORY') return geofenceService.resolveTerritory(employeeId, organizationId);
    return null;
  }

  /** Check-in window right now: the employee's shift, the org policy (morning window), or always open for leadership. */
  checkInWindow(mode: AttendanceMode, shift: Shift | null, policy: AttendancePolicy, now: Date) {
    const today = getISTWorkDate(now);
    if (shift) {
      const occ = shiftCheckInOccurrence(shift, now);
      if (occ) {
        return { from: istHHMM(occ.checkInOpen), to: istHHMM(occ.checkInClose), open: true, workDate: occ.workDate, isLate: now > occ.lateAfter };
      }
      const t = shiftInstants(today, shift);
      return { from: istHHMM(t.checkInOpen), to: istHHMM(t.checkInClose), open: false, workDate: null, isLate: false };
    }
    if (mode === 'ANYWHERE') return { from: '00:00', to: '23:59', open: true, workDate: today, isLate: false };
    const w = isWithinISTWindow(policy.morningStart, policy.morningEnd, now);
    return { from: policy.morningStart, to: policy.morningEnd, open: w.inWindow, workDate: w.inWindow ? today : null, isLate: false };
  }

  /** Check-out window for a given (open) record. */
  checkOutWindow(mode: AttendanceMode, shift: Shift | null, policy: AttendancePolicy, record: AttendanceRecord | null, now: Date): WindowInfo {
    const today = getISTWorkDate(now);
    if (shift) {
      const t = shiftInstants(record?.workDate ?? today, shift);
      return { from: istHHMM(t.checkOutOpen), to: istHHMM(t.checkOutClose), open: !!record && now >= t.checkOutOpen && now <= t.checkOutClose };
    }
    if (mode === 'ANYWHERE') return { from: 'after check-in', to: '23:59', open: !!record && sameDay(record.workDate, today) };
    const w = isWithinISTWindow(policy.eveningStart, policy.eveningEnd, now);
    return { from: policy.eveningStart, to: policy.eveningEnd, open: w.inWindow && !!record && sameDay(record.workDate, today) };
  }

  /**
   * The attendance record that check-out / today's screen should act on.
   * Overnight shifts keep yesterday's record open until its check-out window closes.
   */
  async findCurrentRecord(employeeId: string, shift: Shift | null, now: Date) {
    const today = getISTWorkDate(now);
    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId, workDate: { in: [new Date(today.getTime() - DAY_MS), today, new Date(today.getTime() + DAY_MS)] } },
      orderBy: { workDate: 'desc' },
    });
    const open = records.find((r) => {
      if (!r.checkInAt || r.checkOutAt) return false;
      if (sameDay(r.workDate, today)) return true;
      if (!shift || r.shiftId !== shift.id) return false;
      return now <= shiftInstants(r.workDate, shift).checkOutClose;
    });
    return open ?? records.find((r) => sameDay(r.workDate, today)) ?? null;
  }

  private assertNotFieldTasks(mode: AttendanceMode) {
    if (mode === 'FIELD_TASKS') {
      throw new AppError('Marketing executives mark attendance by checking in at each route stop.', 400, 'USE_FIELD_TASKS');
    }
  }

  private recordLocation(target: GeofenceTarget | null, geo: GeofenceCheck | null) {
    return {
      geofenceValid: true,
      distanceMetres: geo?.distanceMetres ?? null,
      refId: target?.refId ?? null,
      refType: target?.type ?? LocationRefType.ANYWHERE,
      name: target?.refName ?? 'Anywhere (leadership)',
    };
  }

  /** Target sent to the app: identical to the server target (boundary included so the map can draw it). */
  publicTarget(target: GeofenceTarget | null) {
    return target;
  }

  /**
   * Day check-in for every non-route staff type:
   * office / DC / pharmacy / lab (location geofence), sales executive (DC territory), leadership (anywhere).
   * Shift-wise staff use their shift window; others the org morning window.
   */
  async checkIn(userId: string, input: CheckInInput, ipAddress?: string, userAgent?: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const mode = attendanceModeFor(employee.employeeType, employee.staffCategory);
    this.assertNotFieldTasks(mode);
    const policy = await this.getActivePolicy(employee.organizationId);
    const shift = this.activeShift(employee.shift);

    const now = new Date();
    const win = this.checkInWindow(mode, shift, policy, now);
    if (!win.open || !win.workDate) {
      throw new AppError(
        `Check-in${shift ? ` for the ${shift.name} shift` : ''} is allowed only between ${win.from} and ${win.to} IST.`,
        400,
        'OUTSIDE_CHECKIN_WINDOW'
      );
    }
    const workDate = win.workDate;

    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (existing) {
      throw new AppError('You have already checked in today.', 409, 'ALREADY_CHECKED_IN');
    }

    const target = await this.resolveTarget(employee.id, employee.organizationId, mode);
    const geoResult = target ? geofenceService.assertInside(target, input) : null;
    const faceScore = await this.verifyFace(employee.id, policy, input.face);
    const loc = this.recordLocation(target, geoResult);

    return prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          organizationId: employee.organizationId,
          workDate,
          policyVersionId: policy.id,
          status: AttendanceStatus.CHECKED_IN,
          shiftId: shift?.id ?? null,
          shiftName: shift?.name ?? null,
          isLate: win.isLate,
          checkInAt: now,
          checkInLat: input.latitude,
          checkInLng: input.longitude,
          checkInAccuracyMetres: input.accuracy,
          checkInGeofenceValid: loc.geofenceValid,
          checkInDistanceMetres: loc.distanceMetres,
          checkInLocationRefId: loc.refId,
          checkInLocationRefType: loc.refType,
          checkInLocationName: loc.name,
          checkInFaceScore: faceScore,
          checkInSelfie: input.face?.selfie ?? null,
          checkInIsMockLocation: input.isMockLocation ?? null,
        },
      });


      return { record: this.stripSelfies(record), target: this.publicTarget(target), geoResult, faceScore, isLate: win.isLate, mode };
    });
  }

  /**
   * Day check-out: same geofence rules as check-in + work report.
   */
  async checkOut(userId: string, input: CheckOutInput, ipAddress?: string, userAgent?: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const mode = attendanceModeFor(employee.employeeType, employee.staffCategory);
    this.assertNotFieldTasks(mode);
    const policy = await this.getActivePolicy(employee.organizationId);
    const employeeShift = this.activeShift(employee.shift);

    const now = new Date();
    const existing = await this.findCurrentRecord(employee.id, employeeShift, now);
    if (!existing?.checkInAt) {
      throw new AppError('You cannot check out without checking in first.', 400, 'NO_CHECKIN_FOUND');
    }
    if (existing.checkOutAt) {
      throw new AppError('You have already checked out today.', 409, 'ALREADY_CHECKED_OUT');
    }

    // The record keeps the shift it was opened with, even if the employee's shift changed since.
    const shift =
      existing.shiftId && existing.shiftId !== employeeShift?.id
        ? await prisma.shift.findUnique({ where: { id: existing.shiftId } })
        : existing.shiftId
          ? employeeShift
          : null;
    const win = this.checkOutWindow(mode, shift, policy, existing, now);
    if (!win.open) {
      throw new AppError(`Check-out is allowed only between ${win.from} and ${win.to} IST.`, 400, 'OUTSIDE_CHECKOUT_WINDOW');
    }

    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);

    const target = await this.resolveTarget(employee.id, employee.organizationId, mode);
    const geoResult = target ? geofenceService.assertInside(target, input) : null;
    const faceScore = await this.verifyFace(employee.id, policy, input.face);
    const loc = this.recordLocation(target, geoResult);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: now,
          checkOutLat: input.latitude,
          checkOutLng: input.longitude,
          checkOutAccuracyMetres: input.accuracy,
          checkOutGeofenceValid: loc.geofenceValid,
          checkOutDistanceMetres: loc.distanceMetres,
          checkOutLocationRefId: loc.refId,
          checkOutLocationRefType: loc.refType,
          checkOutLocationName: loc.name,
          checkOutFaceScore: faceScore,
          checkOutSelfie: input.face?.selfie ?? null,
          workReport: input.workReport.trim(),
        },
      });


      return { record: this.stripSelfies(updated), target: this.publicTarget(target), geoResult, faceScore, mode };
    });
  }

  /** Selfies are large; only return them on explicit admin request. */
  stripSelfies<T extends { checkInSelfie?: string | null; checkOutSelfie?: string | null }>(record: T) {
    const { checkInSelfie, checkOutSelfie, ...rest } = record;
    return { ...rest, hasCheckInSelfie: !!checkInSelfie, hasCheckOutSelfie: !!checkOutSelfie };
  }

  /** Admin: the selfie captured at check-in or check-out. */
  async getRecordSelfie(organizationId: string, recordId: string, which: 'in' | 'out') {
    const record = await prisma.attendanceRecord.findFirst({
      where: { id: recordId, organizationId },
      select: { checkInSelfie: true, checkOutSelfie: true },
    });
    const selfie = which === 'out' ? record?.checkOutSelfie : record?.checkInSelfie;
    if (!selfie) throw new AppError('No selfie stored for this attendance.', 404, 'NOT_FOUND');
    return { selfie };
  }

  /**
   * Today's status for the staff home screen.
   */
  async getTodayStatus(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const policy = await this.getActivePolicy(employee.organizationId);
    const mode = attendanceModeFor(employee.employeeType, employee.staffCategory);
    const shift = this.activeShift(employee.shift);

    const now = new Date();
    const workDate = getISTWorkDate(now);
    const todayRecord = mode === 'FIELD_TASKS' ? await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    }) : await this.findCurrentRecord(employee.id, shift, now);

    const recordShift =
      todayRecord?.shiftId && todayRecord.shiftId !== shift?.id
        ? await prisma.shift.findUnique({ where: { id: todayRecord.shiftId } })
        : todayRecord && !todayRecord.shiftId
          ? null
          : shift;

    const inWin = this.checkInWindow(mode, shift, policy, now);
    const outWin = this.checkOutWindow(mode, recordShift, policy, todayRecord, now);

    let target: GeofenceTarget | null = null;
    let targetError: string | null = null;
    if (mode === 'BRANCH' || mode === 'TERRITORY') {
      try {
        target = await this.resolveTarget(employee.id, employee.organizationId, mode);
      } catch (err: any) {
        targetError = err.message || 'Unable to resolve your work location.';
      }
    }

    const face = await faceService.getStatus(employee.id);
    const isDayMode = mode !== 'FIELD_TASKS';
    const alreadyCheckedIn = !!todayRecord?.checkInAt && (!inWin.workDate || sameDay(todayRecord.workDate, inWin.workDate));

    return {
      serverTime: now.toISOString(),
      workDate: workDate.toISOString(),
      mode,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        employeeType: employee.employeeType,
        staffCategory: employee.staffCategory,
        categoryLabel: employee.staffCategory ? CATEGORY_LABEL[employee.staffCategory] : null,
        designation: employee.designation,
        dateOfJoining: employee.dateOfJoining,
        location: employee.branchAssignments[0]?.branch
          ? { id: employee.branchAssignments[0].branch.id, name: employee.branchAssignments[0].branch.name }
          : null,
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
      shift: shift
        ? { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, lateGraceMinutes: shift.lateGraceMinutes }
        : null,
      windows: {
        checkIn: { from: inWin.from, to: inWin.to, open: inWin.open, isLate: inWin.isLate },
        checkOut: outWin,
        // kept for older app builds
        inMorningWindow: inWin.open,
        inEveningWindow: outWin.open,
        canCheckIn: isDayMode && inWin.open && !alreadyCheckedIn && !(todayRecord?.checkInAt && !todayRecord.checkOutAt),
        canCheckOut: isDayMode && outWin.open && !!todayRecord?.checkInAt && !todayRecord?.checkOutAt,
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


      return updatedCorrection;
    });
  }

  /**
   * Every active staff member's attendance for a date, classified by staff category.
   * Status per person: PRESENT, COMPLETED (checked out), CORRECTED, ABSENT, NOT_YET (window still open),
   * HOLIDAY, NO_TASKS (route staff without a plan), UPCOMING (future date).
   */
  async getAttendanceBoard(organizationId: string, dateStr?: string) {
    const now = new Date();
    const today = getISTWorkDate(now);
    const workDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : today;
    const isToday = sameDay(workDate, today);
    const isFuture = workDate.getTime() > today.getTime();
    const policy = await this.getActivePolicy(organizationId);

    const [employees, records, tasks, campAssignments, holiday] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId, status: EmployeeStatus.ACTIVE, deletedAt: null, employeeType: { in: [...STAFF_TYPES] } },
        include: {
          shift: true,
          faceProfile: { select: { id: true } },
          branchAssignments: {
            where: { isCurrent: true },
            include: { branch: { select: { id: true, name: true, branchCode: true, district: true, locationType: true } } },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.attendanceRecord.findMany({ where: { organizationId, workDate } }),
      prisma.fieldTask.findMany({
        where: { organizationId, taskDate: workDate, status: { not: 'CANCELLED' } },
        select: { employeeId: true, status: true, deadlineTime: true, lateAccessStatus: true, lateAccessUntil: true },
      }),
      prisma.campAssignment.findMany({
        where: { camp: { organizationId, campDate: workDate, isCancelled: false } },
        include: { camp: { select: { id: true, name: true, startTime: true, endTime: true, locationName: true } } },
      }),
      prisma.holiday.findFirst({ where: { organizationId, holidayDate: workDate, isActive: true } }),
    ]);

    const recordBy = new Map(records.map((r) => [r.employeeId, r]));
    const tasksBy = new Map<string, typeof tasks>();
    for (const t of tasks) tasksBy.set(t.employeeId, [...(tasksBy.get(t.employeeId) ?? []), t]);
    const campsBy = new Map<string, typeof campAssignments>();
    for (const c of campAssignments) campsBy.set(c.employeeId, [...(campsBy.get(c.employeeId) ?? []), c]);
    const morningClosed = !isWithinISTWindow('00:00', policy.morningEnd, now).inWindow;

    const rows = employees.map((e) => {
      const mode = attendanceModeFor(e.employeeType, e.staffCategory);
      const shift = this.activeShift(e.shift);
      const rec = recordBy.get(e.id) ?? null;
      const myTasks = tasksBy.get(e.id) ?? [];
      const branch = e.branchAssignments[0]?.branch ?? null;

      let status: string;
      if (rec) {
        status =
          rec.status === 'CHECKED_OUT' ? 'COMPLETED' : rec.status === 'CORRECTED' ? 'CORRECTED' : rec.status === 'ABSENT' ? 'ABSENT' : 'PRESENT';
      } else if (holiday) status = 'HOLIDAY';
      else if (isFuture) status = 'UPCOMING';
      else if (mode === 'FIELD_TASKS' && myTasks.length === 0) status = 'NO_TASKS';
      else if (!isToday) status = 'ABSENT';
      else if (mode === 'FIELD_TASKS') {
        const open = myTasks.some(
          (t) =>
            istDateTimeFromWorkDate(workDate, t.deadlineTime) > now ||
            (t.lateAccessStatus === 'APPROVED' && !!t.lateAccessUntil && t.lateAccessUntil > now)
        );
        status = open ? 'NOT_YET' : 'ABSENT';
      } else if (shift) status = now <= shiftInstants(workDate, shift).checkInClose ? 'NOT_YET' : 'ABSENT';
      else if (mode === 'ANYWHERE') status = 'NOT_YET';
      else status = morningClosed ? 'ABSENT' : 'NOT_YET';

      return {
        employee: {
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          designation: e.designation,
          dateOfJoining: e.dateOfJoining ? e.dateOfJoining.toISOString().slice(0, 10) : null,
          staffCategory: e.staffCategory,
          employeeType: e.employeeType,
          mobile: e.mobile,
          faceEnrolled: !!e.faceProfile,
        },
        category: e.staffCategory ?? (e.employeeType === 'FIELD_STAFF' ? 'UNCLASSIFIED_FIELD' : 'UNCLASSIFIED_OFFICE'),
        mode,
        location: branch,
        shift: shift ? { name: shift.name, startTime: shift.startTime, endTime: shift.endTime } : null,
        status,
        isLate: !!rec?.isLate,
        record: rec ? this.stripSelfies(rec) : null,
        tasks: myTasks.length
          ? {
              total: myTasks.length,
              visited: myTasks.filter((t) => t.status !== 'PENDING').length,
              completed: myTasks.filter((t) => t.status === 'COMPLETED' || t.status === 'LATE_COMPLETED').length,
            }
          : null,
        camps: (campsBy.get(e.id) ?? []).map((c) => ({
          id: c.camp.id,
          name: c.camp.name,
          locationName: c.camp.locationName,
          time: `${c.camp.startTime}–${c.camp.endTime}`,
          checkInAt: c.checkInAt,
          checkOutAt: c.checkOutAt,
        })),
      };
    });

    const PRESENT = ['PRESENT', 'COMPLETED', 'CORRECTED'];
    const tally = (list: typeof rows) => ({
      total: list.length,
      present: list.filter((r) => PRESENT.includes(r.status)).length,
      checkedOut: list.filter((r) => r.status === 'COMPLETED').length,
      late: list.filter((r) => r.isLate).length,
      absent: list.filter((r) => r.status === 'ABSENT').length,
      notYet: list.filter((r) => r.status === 'NOT_YET').length,
      noTasks: list.filter((r) => r.status === 'NO_TASKS').length,
    });

    const categoryKeys = [...new Set(rows.map((r) => r.category))];
    const byCategory = Object.fromEntries(
      categoryKeys.map((k) => [
        k,
        {
          label:
            (CATEGORY_LABEL as Record<string, string>)[k] ??
            (k === 'UNCLASSIFIED_FIELD' ? 'Field Staff (not classified)' : 'Office Staff (not classified)'),
          ...tally(rows.filter((r) => r.category === k)),
        },
      ])
    );

    return {
      workDate: workDate.toISOString().slice(0, 10),
      isToday,
      holiday: holiday ? holiday.name : null,
      generatedAt: now.toISOString(),
      summary: tally(rows),
      byCategory,
      rows,
    };
  }

  /**
   * Admin Dashboard Attendance Summary for a date (counts come from the full staff board).
   */
  async getDashboardSummary(organizationId: string, dateStr?: string) {
    const board = await this.getAttendanceBoard(organizationId, dateStr);
    const workDate = new Date(`${board.workDate}T00:00:00.000Z`);
    const records = await prisma.attendanceRecord.findMany({
      where: { organizationId, workDate },
      include: { employee: true },
      orderBy: { checkInAt: 'desc' },
    });

    return {
      workDate: workDate.toISOString(),
      totalActiveEmployees: board.summary.total,
      presentCount: board.summary.present,
      absentCount: board.summary.absent,
      notYetCount: board.summary.notYet,
      lateCount: board.summary.late,
      checkedInOnlyCount: board.rows.filter((r) => r.status === 'PRESENT').length,
      checkedOutCount: board.summary.checkedOut,
      correctedCount: board.rows.filter((r) => r.status === 'CORRECTED').length,
      pendingApprovals: await prisma.employee.count({
        where: { organizationId, status: EmployeeStatus.PENDING_APPROVAL, deletedAt: null },
      }),
      pendingLateRequests: await prisma.fieldTask.count({
        where: { organizationId, lateAccessStatus: 'REQUESTED' },
      }),
      recordsSummary: records.map((r) => this.stripSelfies(r)),
    };
  }

  /**
   * Admin direct update of an attendance record.
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


      return {
        success: true,
        message: `Attendance record for ${existing.employee.fullName} on ${existing.workDate.toISOString().slice(0, 10)} deleted.`,
      };
    });
  }

  /**
   * Dashboard analytics for a date range ending today (IST): daily trend, staff categories,
   * locations and check-in times. Presence counts only real check-ins (absent rows excluded).
   */
  async getAnalytics(organizationId: string, days = 14) {
    const span = Math.min(90, Math.max(1, Math.round(days) || 14));
    const DAY_MS = 86_400_000;
    const todayIST = getISTWorkDate(new Date());
    const startDate = new Date(todayIST.getTime() - (span - 1) * DAY_MS);
    const key = (d: Date) => d.toISOString().slice(0, 10);

    const [staff, records, holidays] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId, status: EmployeeStatus.ACTIVE, employeeType: { in: [...STAFF_TYPES] }, deletedAt: null },
        select: {
          id: true,
          employeeType: true,
          staffCategory: true,
          createdAt: true,
          branchAssignments: { where: { isCurrent: true }, select: { branch: { select: { id: true, name: true, district: true } } } },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { organizationId, workDate: { gte: startDate, lte: todayIST } },
        select: {
          employeeId: true,
          workDate: true,
          status: true,
          isLate: true,
          checkInAt: true,
          checkOutAt: true,
          checkInGeofenceValid: true,
          checkInIsMockLocation: true,
          checkInFaceScore: true,
          workReport: true,
        },
      }),
      prisma.holiday.findMany({
        where: { organizationId, isActive: true, holidayDate: { gte: startDate, lte: todayIST } },
        select: { holidayDate: true, name: true },
      }),
    ]);

    const holidayMap = new Map(holidays.map((h) => [key(h.holidayDate), h.name]));
    const present = records.filter((r) => r.status !== AttendanceStatus.ABSENT && r.checkInAt);
    const catOf = (e: { staffCategory: string | null; employeeType: string }) =>
      e.staffCategory ?? (e.employeeType === 'FIELD_STAFF' ? 'UNCLASSIFIED_FIELD' : 'UNCLASSIFIED_OFFICE');
    const staffById = new Map(staff.map((s) => [s.id, s]));
    // An employee counts as expected from the day they were added (midnight IST after the work date).
    const endOfDay = (d: Date) => d.getTime() + DAY_MS - 5.5 * 3_600_000;
    const expectedOn = (d: Date) => staff.filter((s) => s.createdAt.getTime() < endOfDay(d)).length;

    // Daily trend
    const byDay = new Map<string, typeof present>();
    for (const r of present) byDay.set(key(r.workDate), [...(byDay.get(key(r.workDate)) ?? []), r]);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trends = Array.from({ length: span }, (_, i) => {
      const d = new Date(startDate.getTime() + i * DAY_MS);
      const k = key(d);
      const list = byDay.get(k) ?? [];
      const expected = holidayMap.has(k) ? 0 : Math.max(expectedOn(d), list.length);
      const late = list.filter((r) => r.isLate).length;
      return {
        date: k,
        dayOfWeek: dayNames[d.getUTCDay()],
        holiday: holidayMap.get(k) ?? null,
        expected,
        present: list.length,
        onTime: list.length - late,
        late,
        absent: Math.max(0, expected - list.length),
        rate: expected > 0 ? Math.round((list.length / expected) * 100) : null,
      };
    });
    const workingDays = trends.filter((t) => t.expected > 0);

    // Staff categories
    const catAgg = new Map<string, { staff: number; presentDays: number; late: number; possible: number }>();
    for (const s of staff) {
      const c = catOf(s);
      const a = catAgg.get(c) ?? { staff: 0, presentDays: 0, late: 0, possible: 0 };
      a.staff += 1;
      a.possible += workingDays.filter((t) => s.createdAt.getTime() < endOfDay(new Date(`${t.date}T00:00:00Z`))).length;
      catAgg.set(c, a);
    }
    for (const r of present) {
      const s = staffById.get(r.employeeId);
      if (!s) continue;
      const a = catAgg.get(catOf(s))!;
      a.presentDays += 1;
      if (r.isLate) a.late += 1;
    }
    const categories = Array.from(catAgg.entries()).map(([k, a]) => ({
      key: k,
      label:
        CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ??
        (k === 'UNCLASSIFIED_FIELD' ? 'Field Staff (not classified)' : 'Office Staff (not classified)'),
      staff: a.staff,
      presentDays: a.presentDays,
      lateDays: a.late,
      rate: a.possible > 0 ? Math.min(100, Math.round((a.presentDays / a.possible) * 100)) : 0,
    }));

    // Locations (current assignment)
    const todayKey = key(todayIST);
    const locAgg = new Map<
      string,
      { id: string; name: string; district: string; staff: Set<string>; presentDays: number; today: number; inFence: number; checked: number }
    >();
    for (const s of staff) {
      const b = s.branchAssignments[0]?.branch;
      if (!b) continue;
      const a = locAgg.get(b.id) ?? { id: b.id, name: b.name, district: b.district, staff: new Set<string>(), presentDays: 0, today: 0, inFence: 0, checked: 0 };
      a.staff.add(s.id);
      locAgg.set(b.id, a);
    }
    for (const r of present) {
      const b = staffById.get(r.employeeId)?.branchAssignments[0]?.branch;
      if (!b) continue;
      const a = locAgg.get(b.id)!;
      a.presentDays += 1;
      if (key(r.workDate) === todayKey) a.today += 1;
      if (r.checkInGeofenceValid !== null) {
        a.checked += 1;
        if (r.checkInGeofenceValid) a.inFence += 1;
      }
    }
    const locations = Array.from(locAgg.values())
      .map((a) => ({
        id: a.id,
        name: a.name,
        district: a.district,
        staff: a.staff.size,
        presentToday: a.today,
        rate:
          workingDays.length && a.staff.size ? Math.min(100, Math.round((a.presentDays / (a.staff.size * workingDays.length)) * 100)) : 0,
        geofenceRate: a.checked ? Math.round((a.inFence / a.checked) * 100) : null,
      }))
      .sort((a, b) => b.staff - a.staff || a.name.localeCompare(b.name));

    // Check-in time distribution (IST hour)
    const hourOf = (d: Date) => Number(d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })) % 24;
    const hours = new Map<number, { onTime: number; late: number }>();
    for (const r of present) {
      const h = hourOf(r.checkInAt!);
      const v = hours.get(h) ?? { onTime: 0, late: 0 };
      if (r.isLate) v.late += 1;
      else v.onTime += 1;
      hours.set(h, v);
    }
    const hourKeys = Array.from(hours.keys());
    const minH = Math.min(7, ...hourKeys);
    const maxH = Math.max(19, ...hourKeys);
    const checkInHours = Array.from({ length: maxH - minH + 1 }, (_, i) => {
      const h = minH + i;
      return { hour: h, label: `${String(h).padStart(2, '0')}:00`, ...(hours.get(h) ?? { onTime: 0, late: 0 }) };
    });

    // KPIs
    const totalExpected = workingDays.reduce((a, t) => a + t.expected, 0);
    const worked = present
      .filter((r) => r.checkOutAt)
      .map((r) => (r.checkOutAt!.getTime() - r.checkInAt!.getTime()) / 3_600_000);
    const fenceChecked = present.filter((r) => r.checkInGeofenceValid !== null);
    const lateCount = present.filter((r) => r.isLate).length;
    const pct = (n: number, d: number, empty: number) => (d ? Math.round((n / d) * 100) : empty);

    return {
      timeframeDays: span,
      from: key(startDate),
      to: todayKey,
      totalActiveEmployees: staff.length,
      kpis: {
        attendanceRate: pct(present.length, totalExpected, 0),
        punctualityRate: pct(present.length - lateCount, present.length, 100),
        geofenceComplianceRate: pct(fenceChecked.filter((r) => r.checkInGeofenceValid).length, fenceChecked.length, 100),
        avgHoursWorked: worked.length ? Math.round((worked.reduce((a, b) => a + b, 0) / worked.length) * 10) / 10 : 0,
        workReportRate: pct(present.filter((r) => !!r.workReport).length, present.length, 0),
        faceVerifiedRate: pct(present.filter((r) => r.checkInFaceScore !== null).length, present.length, 0),
        mockLocationFlags: present.filter((r) => r.checkInIsMockLocation).length,
        totalCheckIns: present.length,
        lateCount,
      },
      trends,
      categories,
      locations,
      checkInHours,
    };
  }
}

export const attendanceService = new AttendanceService();
