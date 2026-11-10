import { PrismaClient, UserRole, EmployeeType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or upsert Organization
  let org = await prisma.organization.findFirst({
    where: { slug: { in: ['labe', 'laba'] } },
  });

  if (org) {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'LABE Pharmacy',
        slug: 'labe',
      },
    });
  } else {
    org = await prisma.organization.create({
      data: {
        name: 'LABE Pharmacy',
        slug: 'labe',
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
    });
  }

  console.log('✅ Organization updated/created:', org.name);

  // Common password hash for test accounts
  const passwordHash = await bcrypt.hash('Password@123', 12);

  // 2. Create Super Admin User (both labe.in and laba.in for compatibility)
  const superAdminEmails = ['superadmin@labe.in', 'superadmin@laba.in'];
  let primarySuperAdminId = '';
  for (const email of superAdminEmails) {
    const superAdminUser = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    if (email === 'superadmin@labe.in') {
      primarySuperAdminId = superAdminUser.id;
    }

    await prisma.employee.upsert({
      where: { userId: superAdminUser.id },
      update: {
        fullName: 'LABE Super Administrator',
      },
      create: {
        userId: superAdminUser.id,
        organizationId: org.id,
        employeeCode: email.includes('labe') ? 'LABE-SA-001' : 'LABA-SA-001',
        fullName: 'LABE Super Administrator',
        mobile: '9876543210',
        employeeType: EmployeeType.SUPER_ADMIN,
        status: 'ACTIVE',
        createdById: superAdminUser.id,
      },
    });
  }

  console.log('✅ Super Admin accounts ready: superadmin@labe.in, superadmin@laba.in');

  // 3. Create Admin User
  const adminEmails = ['admin@labe.in', 'admin@laba.in'];
  let primaryAdminId = '';
  for (const email of adminEmails) {
    const adminUser = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (email === 'admin@labe.in') {
      primaryAdminId = adminUser.id;
    }

    await prisma.employee.upsert({
      where: { userId: adminUser.id },
      update: {
        fullName: 'LABE Regional Manager',
      },
      create: {
        userId: adminUser.id,
        organizationId: org.id,
        employeeCode: email.includes('labe') ? 'LABE-AD-001' : 'LABA-AD-001',
        fullName: 'LABE Regional Manager',
        mobile: '9876543211',
        employeeType: EmployeeType.ADMIN,
        status: 'ACTIVE',
        createdById: primarySuperAdminId,
      },
    });
  }

  console.log('✅ Admin accounts ready: admin@labe.in, admin@laba.in');

  // 4. Default Attendance Policy
  const policy = await prisma.attendancePolicy.upsert({
    where: {
      organizationId_version: {
        organizationId: org.id,
        version: 1,
      },
    },
    update: { isCurrent: true },
    create: {
      organizationId: org.id,
      version: 1,
      isCurrent: true,
      morningStart: '09:00',
      morningEnd: '09:20',
      eveningStart: '16:30',
      eveningEnd: '17:00',
      defaultGeofenceRadiusMetres: 100,
      minReportLength: 5,
      maxReportLength: 500,
      gpsAccuracyWarnMetres: 100,
      gpsAccuracyRejectMetres: 200,
      allowUnrestrictedFieldCheckin: true,
      timezone: 'Asia/Kolkata',
      effectiveFrom: new Date(),
      createdById: primarySuperAdminId,
      notes: 'Initial company attendance policy for Andhra Pradesh branches',
    },
  });

  console.log('✅ Attendance Policy v1 verified');

  // 5. Create Pharmacy Branches
  const branchesData = [
    {
      branchCode: 'LABE-B-001',
      oldCode: 'LABA-B-001',
      name: 'LABE Pharmacy - Kadapa Main Branch',
      address: '7/120 Main Bazaar Road, Kadapa',
      district: 'YSR Kadapa',
      state: 'Andhra Pradesh',
      latitude: 14.4674,
      longitude: 78.8241,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABE-B-002',
      oldCode: 'LABA-B-002',
      name: 'LABE Pharmacy - Nandyal Branch',
      address: 'Gandhi Chowk, Nandyal',
      district: 'Nandyal',
      state: 'Andhra Pradesh',
      latitude: 15.4788,
      longitude: 78.4836,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABE-B-003',
      oldCode: 'LABA-B-003',
      name: 'LABE Pharmacy - Kurnool Branch',
      address: 'Old Bus Stand Road, Kurnool',
      district: 'Kurnool',
      state: 'Andhra Pradesh',
      latitude: 15.8281,
      longitude: 78.0373,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABE-B-004',
      oldCode: 'LABA-B-004',
      name: 'LABE Pharmacy - Guntur Branch',
      address: 'Arundelpet Main Road, Guntur',
      district: 'Guntur',
      state: 'Andhra Pradesh',
      latitude: 16.3067,
      longitude: 80.4365,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABE-B-005',
      oldCode: 'LABA-B-005',
      name: 'LABE Pharmacy - Vijayawada Branch',
      address: 'Besant Road, Governorpet, Vijayawada',
      district: 'NTR',
      state: 'Andhra Pradesh',
      latitude: 16.5062,
      longitude: 80.6480,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABE-B-006',
      oldCode: 'LABA-B-006',
      name: 'LABE Pharmacy - Ongole Branch',
      address: 'Trunk Road, Ongole',
      district: 'Prakasam',
      state: 'Andhra Pradesh',
      latitude: 15.5057,
      longitude: 80.0499,
      geofenceRadiusMetres: 100,
    },
  ];

  const createdBranches = [];
  for (const b of branchesData) {
    // If old branch code exists, rename it
    const existingOld = await prisma.branch.findUnique({ where: { branchCode: b.oldCode } });
    if (existingOld) {
      const updated = await prisma.branch.update({
        where: { id: existingOld.id },
        data: {
          branchCode: b.branchCode,
          name: b.name,
        },
      });
      createdBranches.push(updated);
      continue;
    }

    const branch = await prisma.branch.upsert({
      where: { branchCode: b.branchCode },
      update: { name: b.name },
      create: {
        organizationId: org.id,
        branchCode: b.branchCode,
        name: b.name,
        address: b.address,
        district: b.district,
        state: b.state,
        latitude: b.latitude,
        longitude: b.longitude,
        geofenceRadiusMetres: b.geofenceRadiusMetres,
        isActive: true,
        createdById: primaryAdminId || primarySuperAdminId,
      },
    });
    createdBranches.push(branch);
  }

  console.log(`✅ ${createdBranches.length} LABE Pharmacy Branches configured`);

  // 6. Create Sample Office Staff assigned to Kadapa
  const officeEmails = ['officestaff@labe.in', 'officestaff@laba.in'];
  for (const email of officeEmails) {
    const officeUser = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        role: UserRole.OFFICE_STAFF,
        isActive: true,
      },
    });

    const officeEmp = await prisma.employee.upsert({
      where: { userId: officeUser.id },
      update: { fullName: 'Priya Sharma' },
      create: {
        userId: officeUser.id,
        organizationId: org.id,
        employeeCode: email.includes('labe') ? 'LABE-OS-001' : 'LABA-OS-001',
        fullName: 'Priya Sharma',
        mobile: '9876543212',
        employeeType: EmployeeType.OFFICE_STAFF,
        status: 'ACTIVE',
        createdById: primaryAdminId || primarySuperAdminId,
      },
    });

    // Check if assignment exists
    const existingAssign = await prisma.branchAssignment.findFirst({
      where: { employeeId: officeEmp.id, isCurrent: true },
    });

    if (!existingAssign && createdBranches[0]) {
      await prisma.branchAssignment.create({
        data: {
          employeeId: officeEmp.id,
          branchId: createdBranches[0].id,
          effectiveFrom: new Date(),
          isCurrent: true,
          assignedById: primaryAdminId || primarySuperAdminId,
          notes: 'Assignment to Kadapa Main Branch',
        },
      });
    }
  }

  console.log('✅ Office Staff ready: officestaff@labe.in (Assigned to Kadapa)');

  // 7. Create Sample Field Staff
  const fieldEmails = ['fieldstaff@labe.in', 'fieldstaff@laba.in'];
  for (const email of fieldEmails) {
    const fieldUser = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        role: UserRole.FIELD_STAFF,
        isActive: true,
      },
    });

    await prisma.employee.upsert({
      where: { userId: fieldUser.id },
      update: { fullName: 'Ramesh Kumar' },
      create: {
        userId: fieldUser.id,
        organizationId: org.id,
        employeeCode: email.includes('labe') ? 'LABE-FS-001' : 'LABA-FS-001',
        fullName: 'Ramesh Kumar',
        mobile: '9876543213',
        employeeType: EmployeeType.FIELD_STAFF,
        status: 'ACTIVE',
        createdById: primaryAdminId || primarySuperAdminId,
      },
    });
  }

  console.log('✅ Field Staff ready: fieldstaff@labe.in');
  console.log('\n🚀 LABE Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
