import ExcelJS from 'exceljs';
import { Prisma, StaffCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { getISTWorkDate } from '../utils/timeWindows';
import { CATEGORY_LABEL } from '../utils/staff';

/**
 * Excel export of everything staff write about their work for a date range:
 * daily check-out work reports, field-route visit notes with survey data, and camp reports.
 */

const DAY = 86_400_000;
const MAX_RANGE_DAYS = 366;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseYmd = (s: string, field: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError(`${field} must be YYYY-MM-DD.`, 400, 'INVALID_DATE');
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid ${field}.`, 400, 'INVALID_DATE');
  return d;
};
const istTime = (d?: Date | null) =>
  d ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const catLabel = (c?: StaffCategory | null) => (c ? CATEGORY_LABEL[c] : '');

/** Survey fields captured by marketing executives (same keys as the staff app form). */
const SURVEY_COLUMNS: [string, string][] = [
  ['outletName', 'Outlet / Doctor'],
  ['outletType', 'Outlet Type'],
  ['contactPerson', 'Contact Person'],
  ['contactMobile', 'Contact Mobile'],
  ['productsDiscussed', 'Products Discussed'],
  ['orderValue', 'Order Value (₹)'],
  ['nextVisitDate', 'Next Visit'],
  ['competitorInfo', 'Competitor Info'],
  ['feedback', 'Feedback'],
];

export interface WorkReportQuery {
  from?: string;
  to?: string;
  category?: string;
  employeeId?: string;
}

export class WorkReportService {
  resolveRange(q: WorkReportQuery) {
    const today = getISTWorkDate(new Date());
    const to = q.to ? parseYmd(q.to, 'To date') : today;
    const from = q.from ? parseYmd(q.from, 'From date') : new Date(to.getTime() - 6 * DAY);
    if (from > to) throw new AppError('From date must be on or before the To date.', 400, 'INVALID_RANGE');
    if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) {
      throw new AppError(`Choose a range of at most ${MAX_RANGE_DAYS} days.`, 400, 'INVALID_RANGE');
    }
    return { from, to };
  }

  async buildWorkbook(organizationId: string, q: WorkReportQuery) {
    const { from, to } = this.resolveRange(q);
    const category =
      q.category && q.category !== 'ALL' && (Object.values(StaffCategory) as string[]).includes(q.category)
        ? (q.category as StaffCategory)
        : undefined;
    const employeeWhere: Prisma.EmployeeWhereInput = {
      ...(category && { staffCategory: category }),
      ...(q.employeeId && { id: q.employeeId }),
    };
    const employeeSelect = { employeeCode: true, fullName: true, designation: true, staffCategory: true } as const;

    const [records, tasks, assignments] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { organizationId, workDate: { gte: from, lte: to }, workReport: { not: null }, employee: employeeWhere },
        orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
        select: {
          workDate: true,
          checkInAt: true,
          checkOutAt: true,
          checkInLocationName: true,
          workReport: true,
          employee: { select: employeeSelect },
        },
      }),
      prisma.fieldTask.findMany({
        where: {
          organizationId,
          taskDate: { gte: from, lte: to },
          OR: [{ completionNote: { not: null } }, { surveyData: { not: Prisma.AnyNull } }, { visitedAt: { not: null } }],
          employee: employeeWhere,
        },
        orderBy: [{ taskDate: 'asc' }, { employeeId: 'asc' }, { sequence: 'asc' }],
        select: {
          taskDate: true,
          sequence: true,
          title: true,
          locationName: true,
          status: true,
          visitedAt: true,
          completedAt: true,
          completionNote: true,
          surveyData: true,
          employee: { select: employeeSelect },
        },
      }),
      prisma.campAssignment.findMany({
        where: {
          camp: { organizationId, campDate: { gte: from, lte: to } },
          report: { not: null },
          employee: employeeWhere,
        },
        orderBy: [{ camp: { campDate: 'asc' } }, { checkInAt: 'asc' }],
        select: {
          checkInAt: true,
          checkOutAt: true,
          report: true,
          camp: { select: { campDate: true, name: true, locationName: true } },
          employee: { select: employeeSelect },
        },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'J-Track';
    wb.created = new Date();
    const header = (ws: ExcelJS.Worksheet) => {
      const row = ws.getRow(1);
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
      row.alignment = { vertical: 'middle' };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
    };
    const wrap = (ws: ExcelJS.Worksheet, keys: string[]) => {
      for (const key of keys) ws.getColumn(key).alignment = { wrapText: true, vertical: 'top' };
    };
    const staffCols = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Category', key: 'cat', width: 20 },
      { header: 'Designation', key: 'desig', width: 20 },
    ];
    const staff = (e: { employeeCode: string; fullName: string; designation: string | null; staffCategory: StaffCategory | null }) => ({
      code: e.employeeCode,
      name: e.fullName,
      cat: catLabel(e.staffCategory),
      desig: e.designation ?? '',
    });

    // About
    const about = wb.addWorksheet('About');
    about.columns = [
      { header: 'Item', key: 'k', width: 26 },
      { header: 'Value', key: 'v', width: 60 },
    ];
    about.addRows([
      { k: 'Report', v: 'J-Track staff work reports' },
      { k: 'From', v: ymd(from) },
      { k: 'To', v: ymd(to) },
      { k: 'Staff category', v: category ? catLabel(category) : 'All categories' },
      { k: 'Daily work reports', v: records.length },
      { k: 'Field visit reports', v: tasks.length },
      { k: 'Camp reports', v: assignments.length },
      { k: 'Generated (IST)', v: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
    ]);
    header(about);

    // Daily work reports (written at check-out)
    const daily = wb.addWorksheet('Daily Work Reports');
    daily.columns = [
      { header: 'Date', key: 'date', width: 12 },
      ...staffCols,
      { header: 'Location', key: 'loc', width: 24 },
      { header: 'Check-In (IST)', key: 'in', width: 13 },
      { header: 'Check-Out (IST)', key: 'out', width: 14 },
      { header: 'Work Report', key: 'report', width: 70 },
    ];
    for (const r of records) {
      daily.addRow({
        date: ymd(r.workDate),
        ...staff(r.employee),
        loc: r.checkInLocationName ?? '',
        in: istTime(r.checkInAt),
        out: istTime(r.checkOutAt),
        report: r.workReport ?? '',
      });
    }
    header(daily);
    wrap(daily, ['report']);

    // Field visit reports (route stops, with marketing survey data spread into columns)
    const extraKeys = new Set<string>();
    for (const t of tasks) {
      if (t.surveyData && typeof t.surveyData === 'object' && !Array.isArray(t.surveyData)) {
        for (const key of Object.keys(t.surveyData)) if (!SURVEY_COLUMNS.some(([k]) => k === key)) extraKeys.add(key);
      }
    }
    const surveyCols: [string, string][] = [...SURVEY_COLUMNS, ...[...extraKeys].map((k): [string, string] => [k, k])];
    const visits = wb.addWorksheet('Field Visit Reports');
    visits.columns = [
      { header: 'Date', key: 'date', width: 12 },
      ...staffCols,
      { header: 'Stop #', key: 'seq', width: 7 },
      { header: 'Task', key: 'title', width: 26 },
      { header: 'Place', key: 'place', width: 26 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Visited (IST)', key: 'visited', width: 12 },
      { header: 'Completed (IST)', key: 'done', width: 14 },
      { header: 'Visit Note', key: 'note', width: 50 },
      ...surveyCols.map(([k, label]) => ({ header: label, key: `s_${k}`, width: 20 })),
    ];
    for (const t of tasks) {
      const survey = (t.surveyData && typeof t.surveyData === 'object' && !Array.isArray(t.surveyData) ? t.surveyData : {}) as Record<string, unknown>;
      visits.addRow({
        date: ymd(t.taskDate),
        ...staff(t.employee),
        seq: t.sequence,
        title: t.title,
        place: t.locationName,
        status: t.status,
        visited: istTime(t.visitedAt),
        done: istTime(t.completedAt),
        note: t.completionNote ?? '',
        ...Object.fromEntries(surveyCols.map(([k]) => [`s_${k}`, survey[k] === undefined || survey[k] === null ? '' : String(survey[k])])),
      });
    }
    header(visits);
    wrap(visits, ['note']);

    // Camp reports
    const camps = wb.addWorksheet('Camp Reports');
    camps.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Camp', key: 'camp', width: 26 },
      { header: 'Camp Location', key: 'loc', width: 26 },
      ...staffCols,
      { header: 'Check-In (IST)', key: 'in', width: 13 },
      { header: 'Check-Out (IST)', key: 'out', width: 14 },
      { header: 'Report', key: 'report', width: 60 },
    ];
    for (const a of assignments) {
      camps.addRow({
        date: ymd(a.camp.campDate),
        camp: a.camp.name,
        loc: a.camp.locationName,
        ...staff(a.employee),
        in: istTime(a.checkInAt),
        out: istTime(a.checkOutAt),
        report: a.report ?? '',
      });
    }
    header(camps);
    wrap(camps, ['report']);

    const filename = `J-Track_Work_Reports_${ymd(from)}_to_${ymd(to)}.xlsx`;
    return { workbook: wb, filename };
  }
}

export const workReportService = new WorkReportService();
