import { Request, Response, NextFunction } from 'express';
import { excelService } from '../services/excel.service';
import { sendSuccess } from '../utils/response';
import { prisma } from '../config/database';
import { getISTWorkDate } from '../utils/timeWindows';
import { AttendanceStatus, EmployeeStatus } from '@prisma/client';

export class ReportController {
  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const dateStr = req.query.date as string | undefined;
      const workbook = await excelService.generateDailyAttendanceWorkbook(req.user!.organizationId, dateStr);

      const filename = `LABA_Attendance_Report_${dateStr || new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  async getPresentList(req: Request, res: Response, next: NextFunction) {
    try {
      const dateStr = req.query.date as string | undefined;
      const workDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : getISTWorkDate(new Date());

      const records = await prisma.attendanceRecord.findMany({
        where: {
          organizationId: req.user!.organizationId,
          workDate,
          status: {
            in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT, AttendanceStatus.CORRECTED],
          },
        },
        include: {
          employee: {
            include: {
              branchAssignments: { where: { isCurrent: true }, include: { branch: true } },
            },
          },
        },
      });

      return sendSuccess(res, records);
    } catch (error) {
      next(error);
    }
  }

  async getAbsentList(req: Request, res: Response, next: NextFunction) {
    try {
      const dateStr = req.query.date as string | undefined;
      const workDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : getISTWorkDate(new Date());

      const [employees, presentRecords] = await Promise.all([
        prisma.employee.findMany({
          where: {
            organizationId: req.user!.organizationId,
            status: EmployeeStatus.ACTIVE,
          },
          include: {
            branchAssignments: { where: { isCurrent: true }, include: { branch: true } },
            fieldSchedules: { where: { scheduleDate: workDate } },
          },
        }),
        prisma.attendanceRecord.findMany({
          where: {
            organizationId: req.user!.organizationId,
            workDate,
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT, AttendanceStatus.CORRECTED],
            },
          },
          select: { employeeId: true },
        }),
      ]);

      const presentEmployeeIds = new Set(presentRecords.map((r) => r.employeeId));
      const absentEmployees = employees.filter((emp) => !presentEmployeeIds.has(emp.id));

      return sendSuccess(res, absentEmployees);
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
