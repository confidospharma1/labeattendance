/**
 * Empties the database and creates a fresh J-Track organisation with one super admin.
 *
 *   CONFIRM_RESET=ERASE-ALL-DATA \
 *   SUPERADMIN_EMAIL=superadmin@jtrack.in SUPERADMIN_PASSWORD='...' \
 *   npx ts-node scripts/reset-database.ts
 *
 * Every table is truncated: employees, locations, attendance, face enrolments, everything.
 * The password is never stored in the repository; pass it in the environment.
 */
import { PrismaClient, UserRole, EmployeeType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_RESET !== 'ERASE-ALL-DATA') {
    throw new Error('Refusing to run: set CONFIRM_RESET=ERASE-ALL-DATA to erase every table.');
  }
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('SUPERADMIN_EMAIL is missing or invalid.');
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('SUPERADMIN_PASSWORD needs 10+ characters with upper case, lower case and a number.');
  }

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`Emptied ${tables.length} tables.`);

  const org = await prisma.organization.create({
    data: { name: 'J-Track', slug: 'j-track', timezone: 'Asia/Kolkata', isActive: true, retentionDays: 90 },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      employeeCode: 'JT-SA-001',
      fullName: 'J-Track Super Admin',
      mobile: '0000000000',
      employeeType: EmployeeType.SUPER_ADMIN,
      designation: 'Super Administrator',
      status: 'ACTIVE',
      createdById: user.id,
    },
  });

  await prisma.attendancePolicy.create({
    data: {
      organizationId: org.id,
      version: 1,
      isCurrent: true,
      morningStart: '08:30',
      morningEnd: '10:00',
      eveningStart: '17:00',
      eveningEnd: '20:00',
      defaultGeofenceRadiusMetres: 100,
      minReportLength: 5,
      maxReportLength: 500,
      gpsAccuracyWarnMetres: 100,
      gpsAccuracyRejectMetres: 200,
      faceVerificationRequired: true,
      faceMatchThreshold: 0.5,
      lateAccessHours: 24,
      timezone: 'Asia/Kolkata',
      effectiveFrom: new Date(),
      createdById: user.id,
      notes: 'Default J-Track policy: check-in 08:30-10:00, check-out 17:00-20:00 (IST).',
    },
  });

  console.log(`J-Track organisation created. Super admin: ${email}`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
