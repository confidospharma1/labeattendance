import { Prisma, FieldTask, AttendanceStatus, LocationRefType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { getISTWorkDate, istDateTimeFromWorkDate } from '../utils/timeWindows';
import { geofenceService, targetFromRow } from './geofence.service';
import { attendanceService } from './attendance.service';
import { CreateTaskInput, UpdateTaskInput, VisitTaskInput, CompleteTaskInput } from '../schemas/fieldTask.schema';

const DONE_STATUSES = ['COMPLETED', 'LATE_COMPLETED', 'CANCELLED'] as const;
const OVERDUE_LOOKBACK_DAYS = 7;

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Geofence columns from create/update input (POLYGON keeps the boundary, CIRCLE clears it). */
function fenceData(input: { geofenceShape?: 'CIRCLE' | 'POLYGON'; boundary?: unknown; boundaryLabel?: string | null }) {
  if (input.geofenceShape === undefined) return {};
  if (input.geofenceShape === 'POLYGON') {
    return {
      geofenceShape: 'POLYGON' as const,
      boundary: input.boundary as Prisma.InputJsonValue,
      boundaryLabel: input.boundaryLabel || null,
    };
  }
  return { geofenceShape: 'CIRCLE' as const, boundary: Prisma.DbNull, boundaryLabel: null };
}

const taskTarget = (task: FieldTask) => targetFromRow(task, LocationRefType.FIELD_TASK, task.locationName, task.radiusMetres);

/** Computed, time-dependent view of a task's state. */
export function describeTask(task: FieldTask, now = new Date()) {
  const deadlineAt = istDateTimeFromWorkDate(task.taskDate, task.deadlineTime);
  const dayStart = istDateTimeFromWorkDate(task.taskDate, '00:00');
  const done = (DONE_STATUSES as readonly string[]).includes(task.status);
  const deadlinePassed = now > deadlineAt;
  const lateAccessActive =
    task.lateAccessStatus === 'APPROVED' && !!task.lateAccessUntil && now <= task.lateAccessUntil;
  const notStarted = now < dayStart;
  const canWork = !done && !notStarted && (!deadlinePassed || lateAccessActive);

  let displayStatus: string = task.status;
  if (!done && deadlinePassed && !lateAccessActive) displayStatus = 'MISSED';

  const { visitSelfie, ...rest } = task;
  return {
    ...rest,
    latitude: Number(task.latitude),
    longitude: Number(task.longitude),
    taskDate: ymd(task.taskDate),
    hasVisitSelfie: !!visitSelfie,
    deadlineAt: deadlineAt.toISOString(),
    deadlinePassed,
    lateAccessActive,
    notStarted,
    canVisit: canWork && task.status === 'PENDING',
    canComplete: canWork && task.status === 'VISITED',
    canRequestLate:
      !done && deadlinePassed && !lateAccessActive && task.lateAccessStatus !== 'REQUESTED',
    displayStatus,
  };
}

export class FieldTaskService {
  // ─── Admin ────────────────────────────────────────────────────────────────

  private async assertFieldStaff(organizationId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    if (employee.employeeType !== 'FIELD_STAFF') {
      throw new AppError('Tasks can only be assigned to field staff.', 400, 'NOT_FIELD_STAFF');
    }
    if (employee.status !== 'ACTIVE') {
      throw new AppError('Tasks can only be assigned to active employees.', 400, 'EMPLOYEE_INACTIVE');
    }
    return employee;
  }

  private async getOrgTask(organizationId: string, id: string) {
    const task = await prisma.fieldTask.findFirst({ where: { id, organizationId } });
    if (!task) throw new AppError('Task not found.', 404, 'NOT_FOUND');
    return task;
  }

  private async audit(organizationId: string, actorId: string, actorRole: string, action: string, entityId: string, metadata?: object) {
    await prisma.auditLog.create({
      data: { organizationId, actorId, actorRole, action, entityType: 'field_tasks', entityId, metadata: metadata as any },
    });
  }

  async createTask(adminUserId: string, organizationId: string, input: CreateTaskInput) {
    await this.assertFieldStaff(organizationId, input.employeeId);
    const taskDate = toDate(input.taskDate);

    let sequence = input.sequence;
    if (!sequence) {
      const count = await prisma.fieldTask.count({ where: { employeeId: input.employeeId, taskDate } });
      sequence = count + 1;
    }

    const task = await prisma.fieldTask.create({
      data: {
        organizationId,
        employeeId: input.employeeId,
        taskDate,
        sequence,
        title: input.title,
        description: input.description || null,
        locationName: input.locationName,
        address: input.address || null,
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        radiusMetres: input.radiusMetres,
        ...fenceData(input),
        deadlineTime: input.deadlineTime,
        assignedById: adminUserId,
      },
    });
    await this.audit(organizationId, adminUserId, 'ADMIN', 'FIELD_TASK_CREATED', task.id, {
      employeeId: input.employeeId,
      taskDate: input.taskDate,
      title: input.title,
    });
    return describeTask(task);
  }

  async updateTask(adminUserId: string, organizationId: string, id: string, input: UpdateTaskInput) {
    const task = await this.getOrgTask(organizationId, id);
    if (task.status !== 'PENDING') {
      throw new AppError('Only tasks that have not been visited can be edited.', 400, 'TASK_LOCKED');
    }
    if (input.geofenceShape === 'POLYGON' && !input.boundary) {
      throw new AppError('Pick or draw a boundary for a boundary geofence.', 400, 'BOUNDARY_REQUIRED');
    }
    const updated = await prisma.fieldTask.update({
      where: { id },
      data: {
        ...(input.taskDate && { taskDate: toDate(input.taskDate) }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.locationName !== undefined && { locationName: input.locationName }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.latitude !== undefined && { latitude: new Prisma.Decimal(input.latitude) }),
        ...(input.longitude !== undefined && { longitude: new Prisma.Decimal(input.longitude) }),
        ...(input.radiusMetres !== undefined && { radiusMetres: input.radiusMetres }),
        ...fenceData(input),
        ...(input.deadlineTime !== undefined && { deadlineTime: input.deadlineTime }),
        ...(input.sequence !== undefined && { sequence: input.sequence }),
      },
    });
    const { boundary: _b, ...auditInput } = input;
    await this.audit(organizationId, adminUserId, 'ADMIN', 'FIELD_TASK_UPDATED', id, auditInput);
    return describeTask(updated);
  }

  async deleteTask(adminUserId: string, organizationId: string, id: string) {
    const task = await this.getOrgTask(organizationId, id);
    if (task.status === 'PENDING') {
      await prisma.fieldTask.delete({ where: { id } });
      await this.audit(organizationId, adminUserId, 'ADMIN', 'FIELD_TASK_DELETED', id, { title: task.title });
      return { deleted: true };
    }
    // Keep visited/completed tasks as evidence; cancel instead.
    await prisma.fieldTask.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit(organizationId, adminUserId, 'ADMIN', 'FIELD_TASK_CANCELLED', id, { title: task.title });
    return { cancelled: true };
  }

  async listTasks(organizationId: string, dateStr?: string, employeeId?: string) {
    const taskDate = dateStr ? toDate(dateStr) : getISTWorkDate();
    const tasks = await prisma.fieldTask.findMany({
      where: { organizationId, taskDate, ...(employeeId && { employeeId }) },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true, mobile: true } } },
      orderBy: [{ employeeId: 'asc' }, { sequence: 'asc' }],
    });
    const now = new Date();
    return tasks.map((t) => ({ ...describeTask(t, now), employee: t.employee }));
  }

  /** Copies one day's plan for an employee onto another date (all tasks reset to PENDING). */
  async copyDay(adminUserId: string, organizationId: string, employeeId: string, fromDate: string, toDateStr: string) {
    await this.assertFieldStaff(organizationId, employeeId);
    const source = await prisma.fieldTask.findMany({
      where: { organizationId, employeeId, taskDate: toDate(fromDate), status: { not: 'CANCELLED' } },
      orderBy: { sequence: 'asc' },
    });
    if (source.length === 0) throw new AppError(`No tasks found on ${fromDate} to copy.`, 404, 'NO_TASKS');

    const target = toDate(toDateStr);
    const existing = await prisma.fieldTask.count({ where: { employeeId, taskDate: target } });

    const created = await prisma.$transaction(
      source.map((t, i) =>
        prisma.fieldTask.create({
          data: {
            organizationId,
            employeeId,
            taskDate: target,
            sequence: existing + i + 1,
            title: t.title,
            description: t.description,
            locationName: t.locationName,
            address: t.address,
            latitude: t.latitude,
            longitude: t.longitude,
            radiusMetres: t.radiusMetres,
            geofenceShape: t.geofenceShape,
            boundary: t.boundary ?? Prisma.DbNull,
            boundaryLabel: t.boundaryLabel,
            deadlineTime: t.deadlineTime,
            assignedById: adminUserId,
          },
        })
      )
    );
    await this.audit(organizationId, adminUserId, 'ADMIN', 'FIELD_TASKS_COPIED', employeeId, {
      fromDate,
      toDate: toDateStr,
      count: created.length,
    });
    return created.map((t) => describeTask(t));
  }

  async listLateRequests(organizationId: string, status: 'REQUESTED' | 'APPROVED' | 'REJECTED' = 'REQUESTED') {
    const tasks = await prisma.fieldTask.findMany({
      where: { organizationId, lateAccessStatus: status },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { lateRequestedAt: 'desc' },
      take: 200,
    });
    const now = new Date();
    return tasks.map((t) => ({ ...describeTask(t, now), employee: t.employee }));
  }

  async reviewLateRequest(
    adminUserId: string,
    organizationId: string,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string
  ) {
    const task = await this.getOrgTask(organizationId, id);
    if (task.lateAccessStatus !== 'REQUESTED') {
      throw new AppError('There is no pending late-access request for this task.', 400, 'NO_LATE_REQUEST');
    }
    const policy = await attendanceService.getActivePolicy(organizationId);
    const now = new Date();
    const updated = await prisma.fieldTask.update({
      where: { id },
      data: {
        lateAccessStatus: decision,
        lateReviewedById: adminUserId,
        lateReviewedAt: now,
        lateReviewNote: note || null,
        lateAccessUntil: decision === 'APPROVED' ? new Date(now.getTime() + policy.lateAccessHours * 3600_000) : null,
      },
    });
    await this.audit(organizationId, adminUserId, 'ADMIN', `FIELD_TASK_LATE_${decision}`, id, { note });
    return describeTask(updated);
  }

  async getSelfie(organizationId: string, id: string) {
    const task = await prisma.fieldTask.findFirst({ where: { id, organizationId }, select: { visitSelfie: true } });
    if (!task?.visitSelfie) throw new AppError('No selfie stored for this task.', 404, 'NOT_FOUND');
    return { selfie: task.visitSelfie };
  }

  // ─── Field staff ──────────────────────────────────────────────────────────

  /** Today's tasks plus recent overdue/late-access tasks still open. */
  async getMyTasks(userId: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const today = getISTWorkDate();
    const since = new Date(today.getTime() - OVERDUE_LOOKBACK_DAYS * 86400_000);

    const [todayTasks, earlierOpen] = await Promise.all([
      prisma.fieldTask.findMany({
        where: { employeeId: employee.id, taskDate: today, status: { not: 'CANCELLED' } },
        orderBy: { sequence: 'asc' },
      }),
      prisma.fieldTask.findMany({
        where: {
          employeeId: employee.id,
          taskDate: { gte: since, lt: today },
          status: { in: ['PENDING', 'VISITED'] },
        },
        orderBy: [{ taskDate: 'asc' }, { sequence: 'asc' }],
      }),
    ]);

    const now = new Date();
    return {
      date: ymd(today),
      today: todayTasks.map((t) => describeTask(t, now)),
      overdue: earlierOpen.map((t) => describeTask(t, now)),
    };
  }

  private async getMyTask(employeeId: string, id: string) {
    const task = await prisma.fieldTask.findFirst({ where: { id, employeeId } });
    if (!task) throw new AppError('Task not found.', 404, 'NOT_FOUND');
    return task;
  }

  private assertCanWork(task: FieldTask, now: Date) {
    const info = describeTask(task, now);
    if (info.notStarted) {
      throw new AppError(`This task is scheduled for ${info.taskDate}. You can start it on that day.`, 400, 'TASK_NOT_STARTED');
    }
    if (info.deadlinePassed && !info.lateAccessActive) {
      throw new AppError(
        `The deadline (${task.deadlineTime} IST) has passed. Request late access from your admin.`,
        400,
        'TASK_DEADLINE_PASSED'
      );
    }
    return info;
  }

  /** Location check-in at the task site: GPS inside radius + face. Creates the day's attendance on first visit. */
  async visit(userId: string, id: string, input: VisitTaskInput, ipAddress?: string, userAgent?: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const policy = await attendanceService.getActivePolicy(employee.organizationId);
    const task = await this.getMyTask(employee.id, id);
    const now = new Date();

    if (task.status !== 'PENDING') {
      throw new AppError('You have already checked in at this task location.', 409, 'TASK_ALREADY_VISITED');
    }
    const info = this.assertCanWork(task, now);
    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);
    const geo = geofenceService.assertInside(taskTarget(task), input);
    const faceScore = await attendanceService.verifyFace(employee.id, policy, input.face);

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.fieldTask.update({
        where: { id },
        data: {
          status: 'VISITED',
          visitedAt: now,
          visitLat: input.latitude,
          visitLng: input.longitude,
          visitAccuracyMetres: input.accuracy,
          visitDistanceMetres: geo.distanceMetres,
          visitFaceScore: faceScore,
          visitSelfie: input.face?.selfie ?? null,
          visitIsMockLocation: input.isMockLocation ?? null,
        },
      });

      // First verified visit of the day = field attendance check-in
      const existing = await tx.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: task.taskDate } },
      });
      if (!existing) {
        await tx.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            organizationId: employee.organizationId,
            workDate: task.taskDate,
            policyVersionId: policy.id,
            status: AttendanceStatus.CHECKED_IN,
            checkInAt: now,
            checkInLat: input.latitude,
            checkInLng: input.longitude,
            checkInAccuracyMetres: input.accuracy,
            checkInGeofenceValid: true,
            checkInDistanceMetres: geo.distanceMetres,
            checkInLocationRefId: task.id,
            checkInLocationRefType: LocationRefType.FIELD_TASK,
            checkInLocationName: task.locationName,
            checkInFaceScore: faceScore,
            checkInIsMockLocation: input.isMockLocation ?? null,
            isCorrected: info.deadlinePassed, // late visit under admin approval
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: employee.organizationId,
          actorId: userId,
          actorRole: 'FIELD_STAFF',
          action: 'FIELD_TASK_VISITED',
          entityType: 'field_tasks',
          entityId: id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: { distanceMetres: geo.distanceMetres, radius: task.radiusMetres, faceScore, late: info.deadlinePassed },
        },
      });
      return t;
    });

    return describeTask(updated, now);
  }

  /** Completion note at the task site. When every task of the day is done the day is closed (check-out). */
  async complete(userId: string, id: string, input: CompleteTaskInput, ipAddress?: string, userAgent?: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const policy = await attendanceService.getActivePolicy(employee.organizationId);
    const task = await this.getMyTask(employee.id, id);
    const now = new Date();

    if (task.status === 'PENDING') {
      throw new AppError('Check in at the task location before submitting the completion note.', 400, 'TASK_NOT_VISITED');
    }
    if (task.status !== 'VISITED') {
      throw new AppError('This task is already closed.', 409, 'TASK_CLOSED');
    }
    const info = this.assertCanWork(task, now);
    geofenceService.assertGpsQuality(input, policy.gpsAccuracyRejectMetres);
    const geo = geofenceService.assertInside(taskTarget(task), input);
    const survey = input.survey ? Object.fromEntries(Object.entries(input.survey).filter(([, v]) => v !== '' && v !== undefined)) : null;

    const status = info.deadlinePassed ? 'LATE_COMPLETED' : 'COMPLETED';

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.fieldTask.update({
        where: { id },
        data: {
          status,
          completionNote: input.completionNote.trim(),
          ...(survey && Object.keys(survey).length > 0 && { surveyData: survey as Prisma.InputJsonValue }),
          completedAt: now,
          completeLat: input.latitude,
          completeLng: input.longitude,
          completeDistanceMetres: geo.distanceMetres,
        },
      });

      // Close the day once no open tasks remain for that date
      const open = await tx.fieldTask.count({
        where: { employeeId: employee.id, taskDate: task.taskDate, status: { in: ['PENDING', 'VISITED'] } },
      });
      if (open === 0) {
        const dayTasks = await tx.fieldTask.findMany({
          where: { employeeId: employee.id, taskDate: task.taskDate, status: { in: ['COMPLETED', 'LATE_COMPLETED'] } },
          orderBy: { sequence: 'asc' },
        });
        const report = dayTasks.map((d) => `${d.sequence}. ${d.title}: ${d.completionNote ?? ''}`).join('\n');
        await tx.attendanceRecord.updateMany({
          where: { employeeId: employee.id, workDate: task.taskDate, checkOutAt: null },
          data: {
            status: AttendanceStatus.CHECKED_OUT,
            checkOutAt: now,
            checkOutLat: input.latitude,
            checkOutLng: input.longitude,
            checkOutAccuracyMetres: input.accuracy,
            checkOutGeofenceValid: true,
            checkOutDistanceMetres: geo.distanceMetres,
            checkOutLocationRefId: task.id,
            checkOutLocationRefType: LocationRefType.FIELD_TASK,
            checkOutLocationName: task.locationName,
            workReport: report,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: employee.organizationId,
          actorId: userId,
          actorRole: 'FIELD_STAFF',
          action: status === 'LATE_COMPLETED' ? 'FIELD_TASK_LATE_COMPLETED' : 'FIELD_TASK_COMPLETED',
          entityType: 'field_tasks',
          entityId: id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: { distanceMetres: geo.distanceMetres, dayClosed: open === 0 },
        },
      });
      return t;
    });

    return describeTask(updated, now);
  }

  async requestLateAccess(userId: string, id: string, reason: string) {
    const employee = await attendanceService.getEmployeeByUserId(userId);
    const task = await this.getMyTask(employee.id, id);
    const info = describeTask(task);
    if (!info.canRequestLate) {
      throw new AppError(
        task.lateAccessStatus === 'REQUESTED'
          ? 'A late-access request is already pending for this task.'
          : 'Late access is only needed after the deadline for an unfinished task.',
        400,
        'LATE_REQUEST_NOT_ALLOWED'
      );
    }
    const updated = await prisma.fieldTask.update({
      where: { id },
      data: { lateAccessStatus: 'REQUESTED', lateRequestReason: reason, lateRequestedAt: new Date() },
    });
    await this.audit(employee.organizationId, userId, 'FIELD_STAFF', 'FIELD_TASK_LATE_REQUESTED', id, { reason });
    return describeTask(updated);
  }
}

export const fieldTaskService = new FieldTaskService();
