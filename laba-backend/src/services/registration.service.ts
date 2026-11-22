import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateNextEmployeeCode } from '../utils/idGenerator';
import { AppError } from '../utils/AppError';
import { RegisterInput, ApproveInput } from '../schemas/registration.schema';

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
      select: { id: true, name: true, district: true, branchCode: true },
      orderBy: { name: 'asc' },
    });
  }

  async register(input: RegisterInput, ipAddress?: string) {
    const org = await this.getOrganization();

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    if (input.employeeType === 'OFFICE_STAFF') {
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
      const employeeCode = await generateNextEmployeeCode(tx, input.employeeType);
      const emp = await tx.employee.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          employeeCode,
          fullName: input.fullName,
          mobile: input.mobile,
          employeeType: input.employeeType,
          status: 'PENDING_APPROVAL',
          selfRegistered: true,
          createdById: user.id,
        },
      });
      if (input.employeeType === 'OFFICE_STAFF' && input.branchId) {
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
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          actorId: user.id,
          actorRole: input.employeeType,
          action: 'EMPLOYEE_SELF_REGISTERED',
          entityType: 'employees',
          entityId: emp.id,
          ipAddress: ipAddress || null,
        },
      });
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

    const employeeType = input.employeeType ?? employee.employeeType;
    if (employeeType !== 'OFFICE_STAFF' && employeeType !== 'FIELD_STAFF') {
      throw new AppError('Only office or field staff can be approved here.', 400, 'INVALID_TYPE');
    }

    return prisma.$transaction(async (tx) => {
      if (employeeType === 'OFFICE_STAFF') {
        const current = await tx.branchAssignment.findFirst({ where: { employeeId, isCurrent: true } });
        const branchId = input.branchId ?? current?.branchId;
        if (!branchId) throw new AppError('Office staff need a branch. Select one to approve.', 400, 'BRANCH_REQUIRED');
        const branch = await tx.branch.findFirst({ where: { id: branchId, organizationId, isActive: true } });
        if (!branch) throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
        if (!current || current.branchId !== branchId) {
          await tx.branchAssignment.updateMany({ where: { employeeId, isCurrent: true }, data: { isCurrent: false, effectiveTo: new Date() } });
          await tx.branchAssignment.create({
            data: { employeeId, branchId, effectiveFrom: new Date(), isCurrent: true, assignedById: adminUserId },
          });
        }
      } else {
        // Field staff have no fixed branch
        await tx.branchAssignment.updateMany({ where: { employeeId, isCurrent: true }, data: { isCurrent: false, effectiveTo: new Date() } });
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { status: 'ACTIVE', employeeType, approvedById: adminUserId, approvedAt: new Date(), rejectionReason: null },
      });
      await tx.user.update({ where: { id: employee.userId }, data: { role: employeeType } });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: adminUserId,
          actorRole: 'ADMIN',
          action: 'EMPLOYEE_APPROVED',
          entityType: 'employees',
          entityId: employeeId,
          afterState: { employeeType, branchId: input.branchId ?? null },
        },
      });
      return { id: updated.id, status: updated.status, employeeType: updated.employeeType };
    });
  }

  async reject(adminUserId: string, organizationId: string, employeeId: string, reason: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, status: 'PENDING_APPROVAL' },
    });
    if (!employee) throw new AppError('Pending registration not found.', 404, 'NOT_FOUND');
    await prisma.employee.update({ where: { id: employeeId }, data: { status: 'REJECTED', rejectionReason: reason } });
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'EMPLOYEE_REJECTED',
        entityType: 'employees',
        entityId: employeeId,
        metadata: { reason },
      },
    });
    return { id: employeeId, status: 'REJECTED' };
  }
}

export const registrationService = new RegistrationService();
