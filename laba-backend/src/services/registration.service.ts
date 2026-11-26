import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateNextEmployeeCode } from '../utils/idGenerator';
import { AppError } from '../utils/AppError';
import { RegisterInput, ApproveInput } from '../schemas/registration.schema';
import { attendanceModeFor, modeNeedsLocation, roleForCategory } from '../utils/staff';

export class RegistrationService {
  /** The single company organisation that self-registrations join. */
  private async getOrganization() {
    const org = await prisma.organization.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!org) throw new AppError('Organisation is not configured.', 500, 'NO_ORGANIZATION');
    return org;
  }

  /** Public list of branches for the registration form (no sensitive fields). */
  async listPublicBranches() {
    const org = await this.getOrganization();
    return prisma.branch.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, district: true, branchCode: true, locationType: true },
      orderBy: { name: 'asc' },
    });
  }

  async register(input: RegisterInput, ipAddress?: string) {
    const org = await this.getOrganization();

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, organizationId: org.id, isActive: true },
      });
      if (!branch) throw new AppError('Please select a valid branch.', 400, 'BRANCH_REQUIRED');
    }

    const passwordHash = await hashPassword(input.password);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { organizationId: org.id, email: input.email, passwordHash, role: input.employeeType },
      });
      const employeeCode = await generateNextEmployeeCode(tx, input.employeeType, input.staffCategory);
      const emp = await tx.employee.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          employeeCode,
          fullName: input.fullName,
          mobile: input.mobile,
          employeeType: input.employeeType,
          staffCategory: input.staffCategory ?? null,
          designation: input.designation || null,
          dateOfJoining: input.dateOfJoining ? new Date(input.dateOfJoining + 'T00:00:00.000Z') : null,
          status: 'PENDING_APPROVAL',
          selfRegistered: true,
          createdById: user.id,
        },
      });
      if (input.branchId) {
        await tx.branchAssignment.create({
          data: {
            employeeId: emp.id,
            branchId: input.branchId,
            effectiveFrom: new Date(),
            isCurrent: true,
            assignedById: user.id,
            notes: 'Requested during self-registration',
          },
        });
      }
      return emp;
    });

    return {
      employeeCode: employee.employeeCode,
      status: employee.status,
      message: 'Registration submitted. You can sign in once an admin approves your account.',
    };
  }

  async listPending(organizationId: string) {
    return prisma.employee.findMany({
      where: { organizationId, status: 'PENDING_APPROVAL', deletedAt: null },
      include: {
        user: { select: { email: true } },
        branchAssignments: { where: { isCurrent: true }, include: { branch: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(adminUserId: string, organizationId: string, employeeId: string, input: ApproveInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, status: 'PENDING_APPROVAL' },
    });
    if (!employee) throw new AppError('Pending registration not found.', 404, 'NOT_FOUND');

    const category = input.staffCategory ?? employee.staffCategory ?? null;
    const employeeType = category ? roleForCategory(category) : (input.employeeType ?? employee.employeeType);
    if (employeeType !== 'OFFICE_STAFF' && employeeType !== 'FIELD_STAFF') {
      throw new AppError('Only office or field staff can be approved here.', 400, 'INVALID_TYPE');
    }
    const needsLocation = modeNeedsLocation(attendanceModeFor(employeeType, category));
    if (input.shiftId) {
      const shift = await prisma.shift.findFirst({ where: { id: input.shiftId, organizationId } });
      if (!shift) throw new AppError('Shift not found.', 404, 'SHIFT_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.branchAssignment.findFirst({ where: { employeeId, isCurrent: true } });
      if (needsLocation || input.branchId || current) {
        const branchId = input.branchId ?? current?.branchId;
        if (!branchId) throw new AppError('This staff category needs a work location. Select one to approve.', 400, 'BRANCH_REQUIRED');
        const branch = await tx.branch.findFirst({ where: { id: branchId, organizationId, isActive: true } });
        if (!branch) throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
        if (!current || current.branchId !== branchId) {
          await tx.branchAssignment.updateMany({ where: { employeeId, isCurrent: true }, data: { isCurrent: false, effectiveTo: new Date() } });
          await tx.branchAssignment.create({
            data: { employeeId, branchId, effectiveFrom: new Date(), isCurrent: true, assignedById: adminUserId },
          });
        }
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          status: 'ACTIVE',
          employeeType,
          staffCategory: category,
          ...(input.shiftId && { shiftId: input.shiftId }),
          ...(input.designation && { designation: input.designation }),
          approvedById: adminUserId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      await tx.user.update({ where: { id: employee.userId }, data: { role: employeeType } });
      return { id: updated.id, status: updated.status, employeeType: updated.employeeType };
    });
  }

  async reject(adminUserId: string, organizationId: string, employeeId: string, reason: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, status: 'PENDING_APPROVAL' },
    });
    if (!employee) throw new AppError('Pending registration not found.', 404, 'NOT_FOUND');
    await prisma.employee.update({ where: { id: employeeId }, data: { status: 'REJECTED', rejectionReason: reason } });
    return { id: employeeId, status: 'REJECTED' };
  }
}

export const registrationService = new RegistrationService();
