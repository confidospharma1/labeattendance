import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { AssignSingleScheduleInput, AssignWeeklyScheduleInput } from '../schemas/schedule.schema';
import { Prisma } from '@prisma/client';
import { addDays, parseISO } from 'date-fns';

export class ScheduleService {
  /**
   * Assigns or updates a single day's field schedule.
   */
  public async assignSingleDay(
    assignerUserId: string,
    organizationId: string,
    employeeId: string,
    input: AssignSingleScheduleInput
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new AppError('Employee record not found.', 404, 'NOT_FOUND');
    }

    if (employee.employeeType !== 'FIELD_STAFF') {
      throw new AppError(
        'Dynamic field scheduling is only applicable to Field Staff employees.',
        400,
        'INVALID_EMPLOYEE_TYPE'
      );
    }

    const scheduleDate = new Date(input.scheduleDate);

    // Upsert schedule record
    const schedule = await prisma.fieldStaffSchedule.upsert({
      where: {
        employeeId_scheduleDate: {
          employeeId,
          scheduleDate,
        },
      },
      create: {
        employeeId,
        scheduleDate,
        scheduleType: input.scheduleType,
        locationName: input.locationName || null,
        address: input.address || null,
        latitude: input.latitude !== undefined ? new Prisma.Decimal(input.latitude) : null,
        longitude: input.longitude !== undefined ? new Prisma.Decimal(input.longitude) : null,
        geofenceRadiusMetres: input.geofenceRadiusMetres || 6000,
        attendanceEnabled: input.attendanceEnabled ?? true,
        notes: input.notes || null,
        assignedById: assignerUserId,
      },
      update: {
        scheduleType: input.scheduleType,
        locationName: input.locationName || null,
        address: input.address || null,
        latitude: input.latitude !== undefined ? new Prisma.Decimal(input.latitude) : null,
        longitude: input.longitude !== undefined ? new Prisma.Decimal(input.longitude) : null,
        geofenceRadiusMetres: input.geofenceRadiusMetres || 6000,
        attendanceEnabled: input.attendanceEnabled ?? true,
        notes: input.notes || null,
        assignedById: assignerUserId,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: assignerUserId,
        actorRole: 'ADMIN',
        action: 'FIELD_SCHEDULE_UPSERTED',
        entityType: 'field_staff_schedules',
        entityId: schedule.id,
        afterState: {
          employeeId,
          scheduleDate: input.scheduleDate,
          scheduleType: input.scheduleType,
          locationName: input.locationName,
        },
      },
    });

    return {
      ...schedule,
      latitude: schedule.latitude ? schedule.latitude.toNumber() : null,
      longitude: schedule.longitude ? schedule.longitude.toNumber() : null,
    };
  }

  /**
   * Configures a 7-day recurring or batch schedule.
   */
  public async assignWeeklySchedule(
    assignerUserId: string,
    organizationId: string,
    employeeId: string,
    input: AssignWeeklyScheduleInput
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!employee || employee.employeeType !== 'FIELD_STAFF') {
      throw new AppError('Valid Field Staff employee required.', 400, 'INVALID_EMPLOYEE');
    }

    const startDate = parseISO(input.startDate);

    return prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of input.schedules) {
        const offset = item.dayOffset !== undefined ? item.dayOffset : (item as any).dayOfWeek || 0;
        const currentDate = addDays(startDate, offset);

        const record = await tx.fieldStaffSchedule.upsert({
          where: {
            employeeId_scheduleDate: {
              employeeId,
              scheduleDate: currentDate,
            },
          },
          create: {
            employeeId,
            scheduleDate: currentDate,
            scheduleType: item.scheduleType,
            locationName: item.locationName || null,
            address: item.address || null,
            latitude: item.latitude !== undefined ? new Prisma.Decimal(item.latitude) : null,
            longitude: item.longitude !== undefined ? new Prisma.Decimal(item.longitude) : null,
            geofenceRadiusMetres: item.geofenceRadiusMetres || 6000,
            attendanceEnabled: item.attendanceEnabled ?? true,
            notes: item.notes || null,
            assignedById: assignerUserId,
          },
          update: {
            scheduleType: item.scheduleType,
            locationName: item.locationName || null,
            address: item.address || null,
            latitude: item.latitude !== undefined ? new Prisma.Decimal(item.latitude) : null,
            longitude: item.longitude !== undefined ? new Prisma.Decimal(item.longitude) : null,
            geofenceRadiusMetres: item.geofenceRadiusMetres || 6000,
            attendanceEnabled: item.attendanceEnabled ?? true,
            notes: item.notes || null,
            assignedById: assignerUserId,
          },
        });

        results.push(record);
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: assignerUserId,
          actorRole: 'ADMIN',
          action: 'WEEKLY_FIELD_SCHEDULE_ASSIGNED',
          entityType: 'field_staff_schedules',
          afterState: {
            employeeId,
            startDate: input.startDate,
            daysConfigured: input.schedules.length,
          },
        },
      });

      return results;
    });
  }

  /**
   * Retrieves schedule records for an employee within a date window.
   */
  public async getEmployeeSchedules(
    organizationId: string,
    employeeId: string,
    startDateStr?: string,
    endDateStr?: string
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    }

    const where: Prisma.FieldStaffScheduleWhereInput = {
      employeeId,
      ...(startDateStr &&
        endDateStr && {
          scheduleDate: {
            gte: new Date(startDateStr),
            lte: new Date(endDateStr),
          },
        }),
    };

    const schedules = await prisma.fieldStaffSchedule.findMany({
      where,
      orderBy: { scheduleDate: 'asc' },
    });

    return schedules.map((s) => ({
      id: s.id,
      scheduleDate: s.scheduleDate.toISOString().split('T')[0],
      scheduleType: s.scheduleType,
      locationName: s.locationName,
      address: s.address,
      latitude: s.latitude ? s.latitude.toNumber() : null,
      longitude: s.longitude ? s.longitude.toNumber() : null,
      geofenceRadiusMetres: s.geofenceRadiusMetres,
      attendanceEnabled: s.attendanceEnabled,
      notes: s.notes,
    }));
  }
}

export const scheduleService = new ScheduleService();

