import { Camp, CampAssignment, LocationRefType, Prisma, AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { getISTWorkDate, istDateTimeFromWorkDate } from '../utils/timeWindows';
import { geofenceService, targetFromRow } from './geofence.service';
import { attendanceService } from './attendance.service';
import { CampInput, CampUpdateInput, CampProofInput, CampCheckOutInput } from '../schemas/camp.schema';

const OPENS_BEFORE_MIN = 30;
const CLOSES_AFTER_MIN = 120;
const DAY_MS = 86_400_000;

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const asJson = (g: unknown) => g as Prisma.InputJsonValue;

function fenceData(input: { geofenceShape?: 'CIRCLE' | 'POLYGON'; boundary?: unknown; boundaryLabel?: string | null }) {
  if (input.geofenceShape === 'POLYGON') {
    return { geofenceShape: 'POLYGON' as const, boundary: asJson(input.boundary), boundaryLabel: input.boundaryLabel || null };
  }
  if (input.geofenceShape === 'CIRCLE') return { geofenceShape: 'CIRCLE' as const, boundary: Prisma.DbNull, boundaryLabel: null };
  return {};
}

/** Time-dependent view of a camp for a staff member. */
function describe(camp: Camp, assignment: CampAssignment | null, now = new Date()) {
  const start = istDateTimeFromWorkDate(camp.campDate, camp.startTime);
  let end = istDateTimeFromWorkDate(camp.campDate, camp.endTime);
  if (end <= start) end = new Date(end.getTime() + DAY_MS);
  const opensAt = new Date(start.getTime() - OPENS_BEFORE_MIN * 60_000);
  const closesAt = new Date(end.getTime() + CLOSES_AFTER_MIN * 60_000);
  const checkedIn = !!assignment?.checkInAt;
  const checkedOut = !!assignment?.checkOutAt;
  return {
    id: camp.id,
    name: camp.name,
    description: camp.description,
    campDate: ymd(camp.campDate),
    startTime: camp.startTime,
    endTime: camp.endTime,
    locationName: camp.locationName,
    address: camp.address,
    latitude: Number(camp.latitude),
    longitude: Number(camp.longitude),
    radiusMetres: camp.radiusMetres,
    geofenceShape: camp.geofenceShape,
    boundary: camp.boundary,
    boundaryLabel: camp.boundaryLabel,
    isCancelled: camp.isCancelled,
    checkInOpensAt: opensAt.toISOString(),
    checkInClosesAt: end.toISOString(),
    checkOutClosesAt: closesAt.toISOString(),
    checkInAt: assignment?.checkInAt ?? null,
    checkOutAt: assignment?.checkOutAt ?? null,
    report: assignment?.report ?? null,
    canCheckIn: !camp.isCancelled && !checkedIn && now >= opensAt && now <= end,
    canCheckOut: !camp.isCancelled && checkedIn && !checkedOut && now <= closesAt,
    status: camp.isCancelled ? 'CANCELLED' : checkedOut ? 'DONE' : checkedIn ? 'AT_CAMP' : now > end ? 'MISSED' : now < opensAt ? 'UPCOMING' : 'OPEN',
  };
}

export class CampService {
  private async getOrgCamp(organizationId: string, id: string) {
    const camp = await prisma.camp.findFirst({ where: { id, organizationId } });
    if (!camp) throw new AppError('Camp not found.', 404, 'NOT_FOUND');
    return camp;
  }

  private async assertStaff(organizationId: string, employeeIds: string[]) {
    if (employeeIds.length === 0) return;
    const count = await prisma.employee.count({
      where: { id: { in: employeeIds }, organizationId, status: 'ACTIVE', deletedAt: null, employeeType: { in: ['OFFICE_STAFF', 'FIELD_STAFF'] } },
    });
    if (count !== new Set(employeeIds).size) {
      throw new AppError('Some selected staff are not active employees.', 400, 'INVALID_STAFF');
    }
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async list(organizationId: string, from?: string, to?: string) {
    const today = getISTWorkDate();
    const camps = await prisma.camp.findMany({
      where: {
        organizationId,
        campDate: {
          gte: from ? toDate(from) : new Date(today.getTime() - 7 * DAY_MS),
          lte: to ? toDate(to) : new Date(today.getTime() + 60 * DAY_MS),
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        assignments: {
          include: { employee: { select: { id: true, fullName: true, employeeCode: true, designation: true } } },
        },
      },
      orderBy: [{ campDate: 'asc' }, { startTime: 'asc' }],
    });
    return camps.map((c) => ({
      ...c,
      campDate: ymd(c.campDate),
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      assignments: c.assignments.map(({ checkInSelfie, ...a }) => ({ ...a, hasCheckInSelfie: !!checkInSelfie })),
    }));
  }

  async create(adminUserId: string, organizationId: string, input: CampInput) {
    await this.assertStaff(organizationId, input.employeeIds);
    const camp = await prisma.camp.create({
      data: {
        organizationId,
        branchId: input.branchId || null,
        name: input.name,
        description: input.description || null,
        campDate: toDate(input.campDate),
        startTime: input.startTime,
        endTime: input.endTime,
        locationName: input.locationName,
        address: input.address || null,
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        radiusMetres: input.radiusMetres,
        ...fenceData(input),
        createdById: adminUserId,
        assignments: { create: [...new Set(input.employeeIds)].map((employeeId) => ({ employeeId })) },
      },
    });
    return camp;
  }

  async update(adminUserId: string, organizationId: string, id: string, input: CampUpdateInput) {
    await this.getOrgCamp(organizationId, id);
    if (input.employeeIds) await this.assertStaff(organizationId, input.employeeIds);

    return prisma.$transaction(async (tx) => {
      const camp = await tx.camp.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description || null }),
          ...(input.branchId !== undefined && { branchId: input.branchId || null }),
          ...(input.campDate !== undefined && { campDate: toDate(input.campDate) }),
          ...(input.startTime !== undefined && { startTime: input.startTime }),
          ...(input.endTime !== undefined && { endTime: input.endTime }),
          ...(input.locationName !== undefined && { locationName: input.locationName }),
          ...(input.address !== undefined && { address: input.address || null }),
          ...(input.latitude !== undefined && { latitude: new Prisma.Decimal(input.latitude) }),
          ...(input.longitude !== undefined && { longitude: new Prisma.Decimal(input.longitude) }),
          ...(input.radiusMetres !== undefined && { radiusMetres: input.radiusMetres }),
          ...(input.isCancelled !== undefined && { isCancelled: input.isCancelled }),
          ...fenceData(input),
        },
      });
      if (input.employeeIds) {
        const wanted = new Set(input.employeeIds);
        const current = await tx.campAssignment.findMany({ where: { campId: id } });
        // Keep anyone who already checked in (their attendance is evidence)
        const removable = current.filter((a) => !wanted.has(a.employeeId) && !a.checkInAt).map((a) => a.id);
        if (removable.length) await tx.campAssignment.deleteMany({ where: { id: { in: removable } } });
        const have = new Set(current.map((a) => a.employeeId));
        const add = [...wanted].filter((e) => !have.has(e));
        if (add.length) await tx.campAssignment.createMany({ data: add.map((employeeId) => ({ campId: id, employeeId })) });
      }
      return camp;
    });
  }

  async remove(adminUserId: string, organizationId: string, id: string) {
    const camp = await this.getOrgCamp(organizationId, id);
    const attended = await prisma.campAssignment.count({ where: { campId: id, checkInAt: { not: null } } });
    if (attended > 0) {
      await prisma.camp.update({ where: { id }, data: { isCancelled: true } });
      return { cancelled: true, message: 'Staff already checked in, so the camp was cancelled instead of deleted.' };
    }
    await prisma.camp.delete({ where: { id } });
    return { deleted: true };
  }

  async getSelfie(organizationId: string, assignmentId: string) {
    const a = await prisma.campAssignment.findFirst({
      where: { id: assignmentId, camp: { organizationId } },
      select: { checkInSelfie: true },
    });
    if (!a?.checkInSelfie) throw new AppError('No selfie stored for this camp check-in.', 404, 'NOT_FOUND');
    return { selfie: a.checkInSelfie };
  }

  // ─── Staff ────────────────────────────────────────────────────────────────

  /** Camps assigned to me from yesterday to the next 14 days. */
  async myCamps(userId: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const today = getISTWorkDate();
    const assignments = await prisma.campAssignment.findMany({
      where: {
        employeeId: employee.id,
        camp: { campDate: { gte: new Date(today.getTime() - DAY_MS), lte: new Date(today.getTime() + 14 * DAY_MS) } },
      },
      include: { camp: true },
      orderBy: { camp: { campDate: 'asc' } },
    });
    const now = new Date();
    return assignments.map((a) => describe(a.camp, a, now));
  }

  private async myAssignment(employeeId: string, campId: string) {
    const a = await prisma.campAssignment.findUnique({
      where: { campId_employeeId: { campId, employeeId } },
      include: { camp: true },
    });
    if (!a) throw new AppError('You are not assigned to this camp.', 403, 'NOT_ASSIGNED');
    return a;
  }

  async checkIn(userId: string, campId: string, input: CampProofInput, ipAddress?: string, userAgent?: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const policy = await attendanceService.getActivePolicy(employee.organizationId);
    const a = await this.myAssignment(employee.id, campId);
    const now = new Date();
    const info = describe(a.camp, a, now);
    if (a.camp.isCancelled) throw new AppError('This camp was cancelled.', 400, 'CAMP_CANCELLED');
    if (a.checkInAt) throw new AppError('You have already checked in at this camp.', 409, 'ALREADY_CHECKED_IN');
    if (!info.canCheckIn) {
      throw new AppError(
        `Camp check-in is open from ${OPENS_BEFORE_MIN} min before ${a.camp.startTime} until ${a.camp.endTime} IST on ${info.campDate}.`,
        400,
        'OUTSIDE_CAMP_WINDOW'
      );
    }
    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);
    const target = targetFromRow(a.camp, LocationRefType.CAMP, a.camp.name, a.camp.radiusMetres);
    const geo = geofenceService.assertInside(target, input);
    const faceScore = await attendanceService.verifyFace(employee.id, policy, input.face);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.campAssignment.update({
        where: { id: a.id },
        data: {
          checkInAt: now,
          checkInLat: input.latitude,
          checkInLng: input.longitude,
          checkInAccuracyMetres: input.accuracy,
          checkInDistanceMetres: geo.distanceMetres,
          checkInFaceScore: faceScore,
          checkInSelfie: input.face?.selfie ?? null,
          checkInIsMockLocation: input.isMockLocation ?? null,
        },
      });
      // A camp day counts as the day's attendance when nothing else was marked
      const existing = await tx.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: a.camp.campDate } },
      });
      if (!existing) {
        await tx.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            organizationId: employee.organizationId,
            workDate: a.camp.campDate,
            policyVersionId: policy.id,
            status: AttendanceStatus.CHECKED_IN,
            checkInAt: now,
            checkInLat: input.latitude,
            checkInLng: input.longitude,
            checkInAccuracyMetres: input.accuracy,
            checkInGeofenceValid: true,
            checkInDistanceMetres: geo.distanceMetres,
            checkInLocationRefId: a.camp.id,
            checkInLocationRefType: LocationRefType.CAMP,
            checkInLocationName: `Camp: ${a.camp.name}`,
            checkInFaceScore: faceScore,
            checkInIsMockLocation: input.isMockLocation ?? null,
          },
        });
      }
      return row;
    });
    return describe(a.camp, updated, now);
  }

  async checkOut(userId: string, campId: string, input: CampCheckOutInput, ipAddress?: string, userAgent?: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const policy = await attendanceService.getActivePolicy(employee.organizationId);
    const a = await this.myAssignment(employee.id, campId);
    const now = new Date();
    const info = describe(a.camp, a, now);
    if (!a.checkInAt) throw new AppError('Check in at the camp first.', 400, 'NO_CHECKIN_FOUND');
    if (a.checkOutAt) throw new AppError('You have already checked out of this camp.', 409, 'ALREADY_CHECKED_OUT');
    if (!info.canCheckOut) throw new AppError('Camp check-out has closed.', 400, 'OUTSIDE_CAMP_WINDOW');
    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);
    const geo = geofenceService.assertInside(targetFromRow(a.camp, LocationRefType.CAMP, a.camp.name, a.camp.radiusMetres), input);
    const faceScore = await attendanceService.verifyFace(employee.id, policy, input.face);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.campAssignment.update({
        where: { id: a.id },
        data: {
          checkOutAt: now,
          checkOutLat: input.latitude,
          checkOutLng: input.longitude,
          checkOutDistanceMetres: geo.distanceMetres,
          checkOutFaceScore: faceScore,
          report: input.report.trim(),
        },
      });
      // Close the day record if the camp opened it
      await tx.attendanceRecord.updateMany({
        where: {
          employeeId: employee.id,
          workDate: a.camp.campDate,
          checkInLocationRefId: a.camp.id,
          checkOutAt: null,
        },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: now,
          checkOutLat: input.latitude,
          checkOutLng: input.longitude,
          checkOutAccuracyMetres: input.accuracy,
          checkOutGeofenceValid: true,
          checkOutDistanceMetres: geo.distanceMetres,
          checkOutLocationRefId: a.camp.id,
          checkOutLocationRefType: LocationRefType.CAMP,
          checkOutLocationName: `Camp: ${a.camp.name}`,
          checkOutFaceScore: faceScore,
          workReport: `Camp ${a.camp.name}: ${input.report.trim()}`,
        },
      });
      return row;
    });
    return describe(a.camp, updated, now);
  }
}

export const campService = new CampService();
