import ExcelJS from 'exceljs';
import { prisma } from '../config/database';
import { getISTWorkDate } from '../utils/timeWindows';
import { EmployeeStatus, AttendanceStatus } from '@prisma/client';
import { format } from 'date-fns';

export class ExcelService {
  async generateDailyAttendanceWorkbook(organizationId: string, dateStr?: string): Promise<ExcelJS.Workbook> {
    const now = new Date();
    const workDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : getISTWorkDate(now);
    const dateFormatted = format(workDate, 'yyyy-MM-dd');

    // 1. Fetch Organization, Employees, and Records
    const [organization, employees, records, corrections] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.employee.findMany({
        where: { organizationId, status: EmployeeStatus.ACTIVE },
        include: {
          branchAssignments: { where: { isCurrent: true }, include: { branch: true } },
          fieldSchedules: { where: { scheduleDate: workDate } },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { organizationId, workDate },
        include: { employee: true },
      }),
      prisma.attendanceCorrection.findMany({
        where: { organizationId },
        include: { employee: true, attendanceRecord: true },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LABE Attendance System';
    workbook.created = new Date();

    const recordMap = new Map(records.map((r) => [r.employeeId, r]));

    const presentEmployees: any[] = [];
    const absentEmployees: any[] = [];
    const officeEmployeesData: any[] = [];
    const fieldEmployeesData: any[] = [];

    for (const emp of employees) {
      const rec = recordMap.get(emp.id);
      const isPresent = rec && (rec.status === AttendanceStatus.CHECKED_IN || rec.status === AttendanceStatus.CHECKED_OUT || rec.status === AttendanceStatus.CORRECTED);

      if (isPresent) {
        presentEmployees.push({ emp, rec });
      } else {
        absentEmployees.push({ emp });
      }

      if (emp.employeeType === 'OFFICE_STAFF') {
        officeEmployeesData.push({ emp, rec });
      } else if (emp.employeeType === 'FIELD_STAFF') {
        fieldEmployeesData.push({ emp, rec });
      }
    }

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
      alignment: { vertical: 'middle', horizontal: 'center' },
    };

    // ── SHEET 1: SUMMARY ────────────────────────────────────────────────────────
    const wsSummary = workbook.addWorksheet('Summary');
    wsSummary.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 28 },
    ];
    wsSummary.getRow(1).font = { bold: true };
    wsSummary.addRows([
      { metric: 'Organization', value: organization?.name || 'LABE' },
      { metric: 'Attendance Work Date', value: dateFormatted },
      { metric: 'Total Active Employees', value: employees.length },
      { metric: 'Present Count', value: presentEmployees.length },
      { metric: 'Absent Count', value: absentEmployees.length },
      { metric: 'Attendance Rate', value: `${employees.length > 0 ? Math.round((presentEmployees.length / employees.length) * 100) : 0}%` },
      { metric: 'Report Generated At (UTC)', value: new Date().toISOString() },
    ]);
    wsSummary.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    // ── SHEET 2: PRESENT STAFF ──────────────────────────────────────────────────
    const wsPresent = workbook.addWorksheet('Present Staff');
    wsPresent.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Full Name', key: 'name', width: 24 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Location / Branch', key: 'location', width: 26 },
      { header: 'Check-In (UTC)', key: 'checkIn', width: 22 },
      { header: 'Check-In GPS', key: 'checkInGps', width: 24 },
      { header: 'Check-Out (UTC)', key: 'checkOut', width: 22 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Work Report', key: 'workReport', width: 40 },
    ];
    for (const item of presentEmployees) {
      wsPresent.addRow({
        code: item.emp.employeeCode,
        name: item.emp.fullName,
        type: item.emp.employeeType,
        location: item.rec?.checkInLocationName || 'N/A',
        checkIn: item.rec?.checkInAt ? format(item.rec.checkInAt, 'HH:mm:ss') : 'N/A',
        checkInGps: item.rec?.checkInLat ? `${item.rec.checkInLat}, ${item.rec.checkInLng}` : 'N/A',
        checkOut: item.rec?.checkOutAt ? format(item.rec.checkOutAt, 'HH:mm:ss') : 'Pending',
        status: item.rec?.status,
        workReport: item.rec?.workReport || 'Pending',
      });
    }
    wsPresent.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    // ── SHEET 3: ABSENT STAFF ───────────────────────────────────────────────────
    const wsAbsent = workbook.addWorksheet('Absent Staff');
    wsAbsent.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Full Name', key: 'name', width: 24 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Mobile', key: 'mobile', width: 18 },
      { header: 'Assigned Branch / Schedule', key: 'assignment', width: 30 },
      { header: 'Status', key: 'status', width: 16 },
    ];
    for (const item of absentEmployees) {
      const branchName = item.emp.branchAssignments[0]?.branch?.name || 'Unassigned';
      wsAbsent.addRow({
        code: item.emp.employeeCode,
        name: item.emp.fullName,
        type: item.emp.employeeType,
        mobile: item.emp.mobile,
        assignment: branchName,
        status: 'ABSENT',
      });
    }
    wsAbsent.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    // ── SHEET 4: OFFICE STAFF ───────────────────────────────────────────────────
    const wsOffice = workbook.addWorksheet('Office Staff');
    wsOffice.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Branch', key: 'branch', width: 22 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Check-In', key: 'checkIn', width: 16 },
      { header: 'Check-Out', key: 'checkOut', width: 16 },
      { header: 'Distance (m)', key: 'distance', width: 14 },
      { header: 'Report', key: 'report', width: 36 },
    ];
    for (const item of officeEmployeesData) {
      wsOffice.addRow({
        code: item.emp.employeeCode,
        name: item.emp.fullName,
        branch: item.emp.branchAssignments[0]?.branch?.name || 'No Branch',
        status: item.rec ? item.rec.status : 'ABSENT',
        checkIn: item.rec?.checkInAt ? format(item.rec.checkInAt, 'HH:mm:ss') : 'N/A',
        checkOut: item.rec?.checkOutAt ? format(item.rec.checkOutAt, 'HH:mm:ss') : 'N/A',
        distance: item.rec?.checkInDistanceMetres ? Number(item.rec.checkInDistanceMetres) : 0,
        report: item.rec?.workReport || '',
      });
    }
    wsOffice.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    // ── SHEET 5: FIELD STAFF ────────────────────────────────────────────────────
    const wsField = workbook.addWorksheet('Field Staff');
    wsField.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Schedule Type', key: 'schedType', width: 20 },
      { header: 'Location Target', key: 'target', width: 26 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Check-In', key: 'checkIn', width: 16 },
      { header: 'Check-Out', key: 'checkOut', width: 16 },
      { header: 'Work Report', key: 'report', width: 36 },
    ];
    for (const item of fieldEmployeesData) {
      const sched = item.emp.fieldSchedules[0];
      wsField.addRow({
        code: item.emp.employeeCode,
        name: item.emp.fullName,
        schedType: sched ? sched.scheduleType : 'UNSCHEDULED',
        target: sched ? sched.locationName || 'N/A' : 'N/A',
        status: item.rec ? item.rec.status : 'ABSENT',
        checkIn: item.rec?.checkInAt ? format(item.rec.checkInAt, 'HH:mm:ss') : 'N/A',
        checkOut: item.rec?.checkOutAt ? format(item.rec.checkOutAt, 'HH:mm:ss') : 'N/A',
        report: item.rec?.workReport || '',
      });
    }
    wsField.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    // ── SHEET 6: CORRECTIONS & AUDIT ────────────────────────────────────────────
    const wsCorrections = workbook.addWorksheet('Corrections & Audit');
    wsCorrections.columns = [
      { header: 'Correction ID', key: 'id', width: 36 },
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Reason', key: 'reason', width: 36 },
      { header: 'Admin Remarks', key: 'adminRemarks', width: 36 },
      { header: 'Requested At', key: 'requestedAt', width: 22 },
    ];
    for (const corr of corrections) {
      wsCorrections.addRow({
        id: corr.id,
        code: corr.employee.employeeCode,
        name: corr.employee.fullName,
        type: corr.correctionType,
        status: corr.status,
        reason: corr.employeeReason,
        adminRemarks: corr.adminReason || 'N/A',
        requestedAt: format(corr.requestedAt, 'yyyy-MM-dd HH:mm:ss'),
      });
    }
    wsCorrections.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    return workbook;
  }
}

export const excelService = new ExcelService();

