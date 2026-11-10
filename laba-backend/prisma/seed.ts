import { PrismaClient, UserRole, EmployeeType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or upsert Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'laba' },
    update: {},
    create: {
      name: 'LABA Pharmacy',
      slug: 'laba',
      timezone: 'Asia/Kolkata',
      isActive: true,
    },
  });

  console.log('✅ Organization created:', org.name);

  // Common password hash for test accounts
  const passwordHash = await bcrypt.hash('Password@123', 12);

  // 2. Create Super Admin User
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@laba.in' },
    update: { passwordHash, isActive: true },
    create: {
      organizationId: org.id,
      email: 'superadmin@laba.in',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  await prisma.employee.upsert({
    where: { userId: superAdminUser.id },
    update: {},
    create: {
      userId: superAdminUser.id,
      organizationId: org.id,
      employeeCode: 'LABA-SA-001',
      fullName: 'LABA Super Administrator',
      mobile: '9876543210',
      employeeType: EmployeeType.SUPER_ADMIN,
      status: 'ACTIVE',
      createdById: superAdminUser.id,
    },
  });

  console.log('✅ Super Admin account created: superadmin@laba.in');

  // 3. Create Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@laba.in' },
    update: { passwordHash, isActive: true },
    create: {
      organizationId: org.id,
      email: 'admin@laba.in',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      employeeCode: 'LABA-AD-001',
      fullName: 'LABA Regional Manager',
      mobile: '9876543211',
      employeeType: EmployeeType.ADMIN,
      status: 'ACTIVE',
      createdById: superAdminUser.id,
    },
  });

  console.log('✅ Admin account created: admin@laba.in');

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
      createdById: superAdminUser.id,
      notes: 'Initial company attendance policy for Andhra Pradesh branches',
    },
  });

  console.log('✅ Attendance Policy v1 created');

  // 5. Create Pharmacy Branches
  const branchesData = [
    {
      branchCode: 'LABA-B-001',
      name: 'LABA Pharmacy - Kadapa Main Branch',
      address: '7/120 Main Bazaar Road, Kadapa',
      district: 'YSR Kadapa',
      state: 'Andhra Pradesh',
      latitude: 14.4674,
      longitude: 78.8241,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABA-B-002',
      name: 'LABA Pharmacy - Nandyal Branch',
      address: 'Gandhi Chowk, Nandyal',
      district: 'Nandyal',
      state: 'Andhra Pradesh',
      latitude: 15.4788,
      longitude: 78.4836,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABA-B-003',
      name: 'LABA Pharmacy - Kurnool Branch',
      address: 'Old Bus Stand Road, Kurnool',
      district: 'Kurnool',
      state: 'Andhra Pradesh',
      latitude: 15.8281,
      longitude: 78.0373,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABA-B-004',
      name: 'LABA Pharmacy - Guntur Branch',
      address: 'Arundelpet Main Road, Guntur',
      district: 'Guntur',
      state: 'Andhra Pradesh',
      latitude: 16.3067,
      longitude: 80.4365,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABA-B-005',
      name: 'LABA Pharmacy - Vijayawada Branch',
      address: 'Besant Road, Governorpet, Vijayawada',
      district: 'NTR',
      state: 'Andhra Pradesh',
      latitude: 16.5062,
      longitude: 80.6480,
      geofenceRadiusMetres: 100,
    },
    {
      branchCode: 'LABA-B-006',
      name: 'LABA Pharmacy - Ongole Branch',
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
    const branch = await prisma.branch.upsert({
      where: { branchCode: b.branchCode },
      update: {},
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
        createdById: adminUser.id,
      },
    });
    createdBranches.push(branch);
  }

  console.log(`✅ ${createdBranches.length} Pharmacy Branches configured`);

  // 6. Create Sample Office Staff assigned to Kadapa
  const officeUser = await prisma.user.upsert({
    where: { email: 'officestaff@laba.in' },
    update: { passwordHash, isActive: true },
    create: {
      organizationId: org.id,
      email: 'officestaff@laba.in',
      passwordHash,
      role: UserRole.OFFICE_STAFF,
      isActive: true,
    },
  });

  const officeEmp = await prisma.employee.upsert({
    where: { userId: officeUser.id },
    update: {},
    create: {
      userId: officeUser.id,
      organizationId: org.id,
      employeeCode: 'LABA-OS-001',
      fullName: 'Priya Sharma',
      mobile: '9876543212',
      employeeType: EmployeeType.OFFICE_STAFF,
      status: 'ACTIVE',
      createdById: adminUser.id,
    },
  });

  // Assign to Kadapa Branch
  await prisma.branchAssignment.create({
    data: {
      employeeId: officeEmp.id,
      branchId: createdBranches[0].id,
      effectiveFrom: new Date(),
      isCurrent: true,
      assignedById: adminUser.id,
      notes: 'Initial assignment to Kadapa Main Branch',
    },
  });

  console.log('✅ Office Staff created: officestaff@laba.in (Assigned to Kadapa Branch)');

  // 7. Create Sample Field Staff
  const fieldUser = await prisma.user.upsert({
    where: { email: 'fieldstaff@laba.in' },
    update: { passwordHash, isActive: true },
    create: {
      organizationId: org.id,
      email: 'fieldstaff@laba.in',
      passwordHash,
      role: UserRole.FIELD_STAFF,
      isActive: true,
    },
  });

  await prisma.employee.upsert({
    where: { userId: fieldUser.id },
    update: {},
    create: {
      userId: fieldUser.id,
      organizationId: org.id,
      employeeCode: 'LABA-FS-001',
      fullName: 'Ramesh Kumar',
      mobile: '9876543213',
      employeeType: EmployeeType.FIELD_STAFF,
      status: 'ACTIVE',
      createdById: adminUser.id,
    },
  });

  console.log('✅ Field Staff created: fieldstaff@laba.in');
  console.log('\n🚀 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

