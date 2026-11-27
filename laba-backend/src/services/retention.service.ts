import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { getISTWorkDate } from '../utils/timeWindows';
import { CATEGORY_LABEL } from '../utils/staff';

/**
 * Data retention for the free Neon plan.
 *
 * Attendance history is the only data that grows every day: attendance records, field-route visits and
 * camp check-ins (no images are stored). Anything dated more than `retentionDays` ago is
 * deleted automatically. Admins see a warning for the last WARNING_DAYS days before a date is deleted, and can
 * download that history as Excel at any time; downloading the archive deletes the archived days straight away.
 * Employees, locations, shifts, customers, face enrolments, holidays and policies are never deleted here.
 */

const DAY = 86_400_000;
export const RETENTION_OPTIONS = [30, 60, 90, 120, 180, 365] as const;
export const DEFAULT_RETENTION_DAYS = 90;
export const WARNING_DAYS = 5;
/** Neon free plan storage. Override with DB_STORAGE_LIMIT_MB if the plan changes. */
const DB_LIMIT_BYTES = Number(process.env.DB_STORAGE_LIMIT_MB || 1024) * 1024 * 1024;
/** Keep the steady-state database under this share of the plan, leaving room for growth. */
const SAFE_SHARE = 0.75;
const ARCHIVE_TOKEN_TTL_MS = 30 * 60_000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const parseYmd = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError('Date must be YYYY-MM-DD.', 400, 'INVALID_DATE');
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new AppError('Invalid date.', 400, 'INVALID_DATE');
  return d;
};
const istTime = (d?: Date | null) =>
  d ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const num = (v: unknown) => (v === null || v === undefined ? '' : Number(v));

const HISTORY_TABLES = ['attendance_records', 'attendance_corrections', 'field_tasks', 'camps', 'camp_assignments'];

export class RetentionService {
  private lastAutoRun = 0;
  private timer: NodeJS.Timeout | null = null;

  private sign(organizationId: string, through: string, issuedAt: number) {
    return crypto.createHmac('sha256', env.JWT_SECRET).update(`archive:${organizationId}:${through}:${issuedAt}`).digest('hex');
  }

  /** Proof that this archive was downloaded; the purge after download requires it. */
  archiveToken(organizationId: string, through: string) {
    const issuedAt = Date.now();
    return `${issuedAt}.${this.sign(organizationId, through, issuedAt)}`;
  }

  private verifyToken(organizationId: string, through: string, token: string) {
    const [ts, sig] = String(token || '').split('.');
    const issuedAt = Number(ts);
    if (!issuedAt || !sig || Date.now() - issuedAt > ARCHIVE_TOKEN_TTL_MS) {
      throw new AppError('The archive download has expired. Download the Excel file again.', 400, 'ARCHIVE_TOKEN_INVALID');
    }
    const expected = this.sign(organizationId, through, issuedAt);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new AppError('Download the Excel archive before deleting this data.', 400, 'ARCHIVE_TOKEN_INVALID');
    }
  }

  /** Latest date that may be archived or deleted: yesterday, so today's attendance is never touched. */
  private latestPurgeable() {
    return addDays(getISTWorkDate(new Date()), -1);
  }

  private async storage() {
    try {
      const [db] = await prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
      const tables = await prisma.$queryRaw<{ name: string; size: bigint }[]>`
        SELECT c.relname AS name, pg_total_relation_size(c.oid) AS size
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r'`;
      const sizeOf = (names: string[]) => tables.filter((t) => names.includes(t.name)).reduce((a, t) => a + Number(t.size), 0);
      return {
        usedBytes: Number(db.size),
        historyBytes: sizeOf(HISTORY_TABLES),
        faceBytes: sizeOf(['face_profiles']),
      };
    } catch (err) {
      logger.warn('Could not read database size', { err: (err as Error).message });
      return null;
    }
  }

  async getStatus(organizationId: string) {
    // Opportunistic clean-up: Render's free instance sleeps, so timers alone are not reliable.
    await this.purgeExpired(organizationId).catch((err) => logger.warn('Retention purge failed', { err: (err as Error).message }));

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new AppError('Organisation not found.', 404, 'NOT_FOUND');
    const retentionDays = org.retentionDays || DEFAULT_RETENTION_DAYS;
    const today = getISTWorkDate(new Date());

    const [oldestRec, oldestTask, oldestCamp, records, tasks, camps, distinctDays, storage] = await Promise.all([
      prisma.attendanceRecord.findFirst({ where: { organizationId }, orderBy: { workDate: 'asc' }, select: { workDate: true } }),
      prisma.fieldTask.findFirst({ where: { organizationId }, orderBy: { taskDate: 'asc' }, select: { taskDate: true } }),
      prisma.camp.findFirst({ where: { organizationId }, orderBy: { campDate: 'asc' }, select: { campDate: true } }),
      prisma.attendanceRecord.count({ where: { organizationId } }),
      prisma.fieldTask.count({ where: { organizationId } }),
      prisma.camp.count({ where: { organizationId } }),
      prisma.attendanceRecord.groupBy({ by: ['workDate'], where: { organizationId } }).then((g) => g.length),
      this.storage(),
    ]);

    const oldestDates = [oldestRec?.workDate, oldestTask?.taskDate, oldestCamp?.campDate].filter(Boolean) as Date[];
    const oldest = oldestDates.length ? new Date(Math.min(...oldestDates.map((d) => d.getTime()))) : null;

    // A day's data is deleted `retentionDays` days after that day.
    const warnThrough = addDays(today, -retentionDays + WARNING_DAYS);
    let alert: null | {
      deleteOn: string;
      daysLeft: number;
      from: string;
      through: string;
      attendanceRecords: number;
      fieldTasks: number;
      camps: number;
      schedule: { deleteOn: string; dataDate: string; records: number }[];
    } = null;

    if (oldest && oldest <= warnThrough) {
      const through = warnThrough < this.latestPurgeable() ? warnThrough : this.latestPurgeable();
      const [r, t, c, perDay] = await Promise.all([
        prisma.attendanceRecord.count({ where: { organizationId, workDate: { lte: through } } }),
        prisma.fieldTask.count({ where: { organizationId, taskDate: { lte: through } } }),
        prisma.camp.count({ where: { organizationId, campDate: { lte: through } } }),
        prisma.attendanceRecord.groupBy({
          by: ['workDate'],
          where: { organizationId, workDate: { lte: through } },
          _count: { _all: true },
          orderBy: { workDate: 'asc' },
        }),
      ]);
      const deleteOn = addDays(oldest, retentionDays);
      alert = {
        deleteOn: ymd(deleteOn < today ? today : deleteOn),
        daysLeft: Math.max(0, Math.round((deleteOn.getTime() - today.getTime()) / DAY)),
        from: ymd(oldest),
        through: ymd(through),
        attendanceRecords: r,
        fieldTasks: t,
        camps: c,
        schedule: perDay.map((d) => ({
          dataDate: ymd(d.workDate),
          deleteOn: ymd(addDays(d.workDate, retentionDays) < today ? today : addDays(d.workDate, retentionDays)),
          records: d._count._all,
        })),
      };
    }

    // Storage projection from the real size of the history tables.
    let projection = null as null | {
      bytesPerDay: number;
      projectedBytes: number;
      recommendedDays: number;
      daysUntilFull: number | null;
    };
    if (storage) {
      const bytesPerDay = distinctDays > 0 ? storage.historyBytes / distinctDays : 0;
      const baseline = Math.max(0, storage.usedBytes - storage.historyBytes);
      const fits = (days: number) => baseline + days * bytesPerDay <= DB_LIMIT_BYTES * SAFE_SHARE;
      const recommendedDays =
        bytesPerDay > 0 ? [...RETENTION_OPTIONS].reverse().find(fits) ?? RETENTION_OPTIONS[0] : DEFAULT_RETENTION_DAYS;
      projection = {
        bytesPerDay: Math.round(bytesPerDay),
        projectedBytes: Math.round(baseline + retentionDays * bytesPerDay),
        recommendedDays,
        daysUntilFull: bytesPerDay > 0 ? Math.max(0, Math.floor((DB_LIMIT_BYTES - storage.usedBytes) / bytesPerDay)) : null,
      };
    }

    return {
      retentionDays,
      options: RETENTION_OPTIONS,
      warningDays: WARNING_DAYS,
      storage: storage && { ...storage, limitBytes: DB_LIMIT_BYTES, percentUsed: Math.round((storage.usedBytes / DB_LIMIT_BYTES) * 1000) / 10 },
      projection,
      history: {
        oldest: oldest ? ymd(oldest) : null,
        attendanceRecords: records,
        fieldTasks: tasks,
        camps,
        daysWithData: distinctDays,
        keepFrom: ymd(addDays(today, -(retentionDays - 1))),
      },
      latestArchivable: ymd(this.latestPurgeable()),
      lastPurgeAt: org.lastPurgeAt,
      lastPurgedThrough: org.lastPurgedThrough ? ymd(org.lastPurgedThrough) : null,
      lastArchiveAt: org.lastArchiveAt,
      alert,
    };
  }

  async setRetentionDays(organizationId: string, days: number) {
    if (!(RETENTION_OPTIONS as readonly number[]).includes(days)) {
      throw new AppError(`Retention must be one of ${RETENTION_OPTIONS.join(', ')} days.`, 400, 'INVALID_RETENTION');
    }
    await prisma.organization.update({ where: { id: organizationId }, data: { retentionDays: days } });
    return this.getStatus(organizationId);
  }

  private clampThrough(throughStr: string) {
    const through = parseYmd(throughStr);
    const latest = this.latestPurgeable();
    if (through > latest) {
      throw new AppError(`Only data up to ${ymd(latest)} can be archived. Today's attendance is still in progress.`, 400, 'DATE_TOO_RECENT');
    }
    return through;
  }

  /** Delete all attendance history dated on or before `through`. */
  private async purgeThrough(organizationId: string, through: Date) {
    const [corrections, records, tasks, camps] = await prisma.$transaction([
      prisma.attendanceCorrection.deleteMany({
        where: {
          organizationId,
          OR: [
            { attendanceRecord: { is: { workDate: { lte: through } } } },
            { attendanceRecordId: null, requestedAt: { lt: addDays(through, 1) } },
          ],
        },
      }),
      prisma.attendanceRecord.deleteMany({ where: { organizationId, workDate: { lte: through } } }),
      prisma.fieldTask.deleteMany({ where: { organizationId, taskDate: { lte: through } } }),
      prisma.camp.deleteMany({ where: { organizationId, campDate: { lte: through } } }), // assignments cascade
      prisma.organization.update({ where: { id: organizationId }, data: { lastPurgeAt: new Date(), lastPurgedThrough: through } }),
    ]);
    return {
      through: ymd(through),
      attendanceRecords: records.count,
      corrections: corrections.count,
      fieldTasks: tasks.count,
      camps: camps.count,
    };
  }

  /** Purge after the admin downloaded the archive (requires the token sent with the download). */
  async purgeAfterArchive(organizationId: string, throughStr: string, token: string) {
    const through = this.clampThrough(throughStr);
    this.verifyToken(organizationId, ymd(through), token);
    const result = await this.purgeThrough(organizationId, through);
    logger.info('Archived history deleted after download', { organizationId, ...result });
    return result;
  }

  /** Delete everything older than each organisation's retention period. Throttled to once an hour. */
  async runAutoPurge(force = false) {
    if (!force && Date.now() - this.lastAutoRun < 3_600_000) return [];
    this.lastAutoRun = Date.now();
    const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, retentionDays: true } });
    const results = [];
    for (const org of orgs) {
      const result = await this.purgeExpired(org.id, org.retentionDays);
      if (result) results.push({ organizationId: org.id, ...result });
    }
    return results;
  }

  /** Delete this organisation's history that is past its retention period, if there is any. */
  async purgeExpired(organizationId: string, retentionDays?: number) {
    const days =
      retentionDays ?? (await prisma.organization.findUnique({ where: { id: organizationId }, select: { retentionDays: true } }))?.retentionDays;
    const through = addDays(getISTWorkDate(new Date()), -(days || DEFAULT_RETENTION_DAYS));
    const [rec, task, camp] = await Promise.all([
      prisma.attendanceRecord.findFirst({ where: { organizationId, workDate: { lte: through } }, select: { id: true } }),
      prisma.fieldTask.findFirst({ where: { organizationId, taskDate: { lte: through } }, select: { id: true } }),
      prisma.camp.findFirst({ where: { organizationId, campDate: { lte: through } }, select: { id: true } }),
    ]);
    if (!rec && !task && !camp) return null;
    const result = await this.purgeThrough(organizationId, through);
    logger.info('Retention: expired attendance history deleted', { organizationId, ...result });
    return result;
  }

  startScheduler() {
    if (env.NODE_ENV === 'test' || this.timer) return;
    const run = () => this.runAutoPurge(true).catch((err) => logger.error('Retention purge failed', { err: (err as Error).message }));
    setTimeout(run, 60_000).unref();
    this.timer = setInterval(run, 3 * 3_600_000);
    this.timer.unref();
  }

  /** Excel workbook with every attendance-history row dated on or before `through`. */
  async buildArchive(organizationId: string, throughStr: string) {
    const through = this.clampThrough(throughStr);
    const [org, records, tasks, camps, corrections] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.attendanceRecord.findMany({
        where: { organizationId, workDate: { lte: through } },
        orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
        select: {
          workDate: true,
          status: true,
          shiftName: true,
          isLate: true,
          checkInAt: true,
          checkInLat: true,
          checkInLng: true,
          checkInAccuracyMetres: true,
          checkInGeofenceValid: true,
          checkInDistanceMetres: true,
          checkInLocationName: true,
          checkInFaceScore: true,
          checkInIsMockLocation: true,
          checkOutAt: true,
          checkOutLocationName: true,
          checkOutGeofenceValid: true,
          checkOutFaceScore: true,
          workReport: true,
          isCorrected: true,
          isAdminCreated: true,
          employee: { select: { id: true, employeeCode: true, fullName: true, designation: true, staffCategory: true, employeeType: true } },
        },
      }),
      prisma.fieldTask.findMany({
        where: { organizationId, taskDate: { lte: through } },
        orderBy: [{ taskDate: 'asc' }, { sequence: 'asc' }],
        select: {
          taskDate: true,
          sequence: true,
          title: true,
          locationName: true,
          deadlineTime: true,
          status: true,
          visitedAt: true,
          visitDistanceMetres: true,
          visitFaceScore: true,
          completedAt: true,
          completionNote: true,
          surveyData: true,
          lateAccessStatus: true,
          lateRequestReason: true,
          employee: { select: { employeeCode: true, fullName: true } },
        },
      }),
      prisma.camp.findMany({
        where: { organizationId, campDate: { lte: through } },
        orderBy: { campDate: 'asc' },
        select: {
          campDate: true,
          name: true,
          locationName: true,
          startTime: true,
          endTime: true,
          isCancelled: true,
          assignments: {
            select: {
              checkInAt: true,
              checkOutAt: true,
              checkInDistanceMetres: true,
              report: true,
              employee: { select: { employeeCode: true, fullName: true } },
            },
          },
        },
      }),
      prisma.attendanceCorrection.findMany({
        where: {
          organizationId,
          OR: [
            { attendanceRecord: { is: { workDate: { lte: through } } } },
            { attendanceRecordId: null, requestedAt: { lt: addDays(through, 1) } },
          ],
        },
        orderBy: { requestedAt: 'asc' },
        select: {
          correctionType: true,
          status: true,
          employeeReason: true,
          adminReason: true,
          requestedAt: true,
          reviewedAt: true,
          attendanceRecord: { select: { workDate: true } },
          employee: { select: { employeeCode: true, fullName: true } },
        },
      }),
    ]);

    const dates = [...records.map((r) => r.workDate), ...tasks.map((t) => t.taskDate), ...camps.map((c) => c.campDate)];
    const from = dates.length ? ymd(new Date(Math.min(...dates.map((d) => d.getTime())))) : ymd(through);

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
    const category = (e: { staffCategory: string | null; employeeType: string }) =>
      e.staffCategory ? CATEGORY_LABEL[e.staffCategory as keyof typeof CATEGORY_LABEL] ?? e.staffCategory : e.employeeType;

    // About
    const about = wb.addWorksheet('About this archive');
    about.columns = [
      { header: 'Item', key: 'k', width: 34 },
      { header: 'Value', key: 'v', width: 60 },
    ];
    about.addRows([
      { k: 'Organisation', v: org?.name ?? 'J-Track' },
      { k: 'Data from', v: from },
      { k: 'Data through', v: ymd(through) },
      { k: 'Attendance records', v: records.length },
      { k: 'Field route stops', v: tasks.length },
      { k: 'Camps', v: camps.length },
      { k: 'Correction requests', v: corrections.length },
      { k: 'Generated at (IST)', v: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
      { k: 'Note', v: 'This data was removed from J-Track after this file was downloaded. Keep this file safe.' },
    ]);
    header(about);

    // Attendance
    const att = wb.addWorksheet('Attendance');
    att.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Category', key: 'cat', width: 26 },
      { header: 'Designation', key: 'desig', width: 20 },
      { header: 'Shift', key: 'shift', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Late', key: 'late', width: 7 },
      { header: 'Check-In (IST)', key: 'in', width: 13 },
      { header: 'Check-In Place', key: 'inPlace', width: 28 },
      { header: 'Inside Geofence', key: 'inFence', width: 14 },
      { header: 'Distance (m)', key: 'dist', width: 12 },
      { header: 'GPS Accuracy (m)', key: 'acc', width: 14 },
      { header: 'Latitude', key: 'lat', width: 12 },
      { header: 'Longitude', key: 'lng', width: 12 },
      { header: 'Face Match %', key: 'face', width: 12 },
      { header: 'Mock Location', key: 'mock', width: 13 },
      { header: 'Check-Out (IST)', key: 'out', width: 14 },
      { header: 'Check-Out Place', key: 'outPlace', width: 28 },
      { header: 'Hours Worked', key: 'hours', width: 12 },
      { header: 'Corrected', key: 'corr', width: 10 },
      { header: 'Work Report', key: 'report', width: 50 },
    ];
    const perEmp = new Map<string, { code: string; name: string; cat: string; desig: string; days: number; late: number; minutes: number; inMinutes: number[] }>();
    for (const r of records) {
      const minutes = r.checkInAt && r.checkOutAt ? Math.max(0, (r.checkOutAt.getTime() - r.checkInAt.getTime()) / 60000) : 0;
      att.addRow({
        date: ymd(r.workDate),
        code: r.employee.employeeCode,
        name: r.employee.fullName,
        cat: category(r.employee),
        desig: r.employee.designation ?? '',
        shift: r.shiftName ?? '',
        status: r.status,
        late: r.isLate ? 'Yes' : '',
        in: istTime(r.checkInAt),
        inPlace: r.checkInLocationName ?? '',
        inFence: r.checkInGeofenceValid === null ? '' : r.checkInGeofenceValid ? 'Yes' : 'No',
        dist: num(r.checkInDistanceMetres),
        acc: num(r.checkInAccuracyMetres),
        lat: num(r.checkInLat),
        lng: num(r.checkInLng),
        face: r.checkInFaceScore === null ? '' : Math.round(r.checkInFaceScore * 100),
        mock: r.checkInIsMockLocation ? 'Yes' : '',
        out: istTime(r.checkOutAt),
        outPlace: r.checkOutLocationName ?? '',
        hours: minutes ? Math.round((minutes / 60) * 100) / 100 : '',
        corr: r.isCorrected || r.isAdminCreated ? 'Yes' : '',
        report: r.workReport ?? '',
      });
      if (r.status !== 'ABSENT') {
        const e = perEmp.get(r.employee.id) ?? {
          code: r.employee.employeeCode,
          name: r.employee.fullName,
          cat: category(r.employee),
          desig: r.employee.designation ?? '',
          days: 0,
          late: 0,
          minutes: 0,
          inMinutes: [],
        };
        e.days += 1;
        if (r.isLate) e.late += 1;
        e.minutes += minutes;
        if (r.checkInAt) {
          const [h, m] = istTime(r.checkInAt).split(':').map(Number);
          e.inMinutes.push(h * 60 + m);
        }
        perEmp.set(r.employee.id, e);
      }
    }
    header(att);

    // Staff summary
    const sum = wb.addWorksheet('Staff Summary');
    sum.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Category', key: 'cat', width: 26 },
      { header: 'Designation', key: 'desig', width: 20 },
      { header: 'Days Present', key: 'days', width: 13 },
      { header: 'Late Days', key: 'late', width: 10 },
      { header: 'Average Check-In (IST)', key: 'avgIn', width: 20 },
      { header: 'Total Hours', key: 'hours', width: 12 },
    ];
    for (const e of Array.from(perEmp.values()).sort((a, b) => a.code.localeCompare(b.code))) {
      const avg = e.inMinutes.length ? Math.round(e.inMinutes.reduce((a, b) => a + b, 0) / e.inMinutes.length) : null;
      sum.addRow({
        code: e.code,
        name: e.name,
        cat: e.cat,
        desig: e.desig,
        days: e.days,
        late: e.late,
        avgIn: avg === null ? '' : `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`,
        hours: Math.round((e.minutes / 60) * 10) / 10,
      });
    }
    header(sum);

    // Field routes
    const fr = wb.addWorksheet('Field Routes');
    fr.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Stop #', key: 'seq', width: 7 },
      { header: 'Task', key: 'title', width: 28 },
      { header: 'Location', key: 'loc', width: 28 },
      { header: 'Deadline', key: 'deadline', width: 9 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Visited (IST)', key: 'visited', width: 12 },
      { header: 'Distance (m)', key: 'dist', width: 12 },
      { header: 'Face Match %', key: 'face', width: 12 },
      { header: 'Completed (IST)', key: 'done', width: 14 },
      { header: 'Completion Note', key: 'note', width: 40 },
      { header: 'Survey Data', key: 'survey', width: 50 },
      { header: 'Late Access', key: 'lateAccess', width: 12 },
      { header: 'Late Reason', key: 'lateReason', width: 30 },
    ];
    for (const t of tasks) {
      fr.addRow({
        date: ymd(t.taskDate),
        code: t.employee.employeeCode,
        name: t.employee.fullName,
        seq: t.sequence,
        title: t.title,
        loc: t.locationName,
        deadline: t.deadlineTime,
        status: t.status,
        visited: istTime(t.visitedAt),
        dist: num(t.visitDistanceMetres),
        face: t.visitFaceScore === null ? '' : Math.round(t.visitFaceScore * 100),
        done: istTime(t.completedAt),
        note: t.completionNote ?? '',
        survey: t.surveyData ? JSON.stringify(t.surveyData) : '',
        lateAccess: t.lateAccessStatus === 'NONE' ? '' : t.lateAccessStatus,
        lateReason: t.lateRequestReason ?? '',
      });
    }
    header(fr);

    // Camps
    const cp = wb.addWorksheet('Camps');
    cp.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Camp', key: 'camp', width: 26 },
      { header: 'Location', key: 'loc', width: 28 },
      { header: 'Time', key: 'time', width: 13 },
      { header: 'Cancelled', key: 'cancelled', width: 10 },
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Check-In (IST)', key: 'in', width: 13 },
      { header: 'Check-Out (IST)', key: 'out', width: 14 },
      { header: 'Distance (m)', key: 'dist', width: 12 },
      { header: 'Report', key: 'report', width: 40 },
    ];
    for (const c of camps) {
      const base = { date: ymd(c.campDate), camp: c.name, loc: c.locationName, time: `${c.startTime}-${c.endTime}`, cancelled: c.isCancelled ? 'Yes' : '' };
      if (!c.assignments.length) cp.addRow(base);
      for (const a of c.assignments) {
        cp.addRow({
          ...base,
          code: a.employee.employeeCode,
          name: a.employee.fullName,
          in: istTime(a.checkInAt),
          out: istTime(a.checkOutAt),
          dist: num(a.checkInDistanceMetres),
          report: a.report ?? '',
        });
      }
    }
    header(cp);

    // Corrections
    const co = wb.addWorksheet('Corrections');
    co.columns = [
      { header: 'Attendance Date', key: 'date', width: 15 },
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Employee Reason', key: 'reason', width: 40 },
      { header: 'Admin Remarks', key: 'admin', width: 36 },
      { header: 'Requested (IST)', key: 'req', width: 20 },
    ];
    for (const c of corrections) {
      co.addRow({
        date: c.attendanceRecord ? ymd(c.attendanceRecord.workDate) : '',
        code: c.employee.employeeCode,
        name: c.employee.fullName,
        type: c.correctionType,
        status: c.status,
        reason: c.employeeReason,
        admin: c.adminReason ?? '',
        req: c.requestedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
    }
    header(co);

    await prisma.organization.update({ where: { id: organizationId }, data: { lastArchiveAt: new Date() } });

    return {
      workbook: wb,
      from,
      through: ymd(through),
      filename: `J-Track_Archive_${from}_to_${ymd(through)}.xlsx`,
      token: this.archiveToken(organizationId, ymd(through)),
    };
  }
}

export const retentionService = new RetentionService();
