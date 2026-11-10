import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateNextEmployeeCode } from '../utils/idGenerator';
import { AppError } from '../utils/AppError';
import { CreateEmployeeInput, UpdateEmployeeInput, UpdateEmployeeStatusInput, ListEmployeesQuery } from '../schemas/employee.schema';
import { Prisma } from '@prisma/client';

export class EmployeeService {
  /**
   * Creates an employee, corresponding user credentials, and active branch assignment in one atomic transaction.
   */
  public async createEmployee(creatorUserId: string, organizationId: string, input: CreateEmployeeInput) {
    // Office Staff mandate active branch assignment (Correction R-2)
    if (input.employeeType === 'OFFICE_STAFF' && !input.branchId) {
      throw new AppError('Office Staff requires a permanent branch assignment.', 400, 'BRANCH_REQUIRED');
    }

    // Verify branch exists and belongs to organization
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, organizationId, isActive: true },
      });
      if (!branch) {
        throw new AppError('Specified branch not found or inactive.', 404, 'BRANCH_NOT_FOUND');
      }
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      // 1. Create User authentication record
      const user = await tx.user.create({
        data: {
          organizationId,
          email: input.email,
          passwordHash,
          role: input.employeeType,
        },
      });

      // 2. Generate sequential Employee code
      const employeeCode = await generateNextEmployeeCode(tx, input.employeeType);

      // 3. Create Employee profile record
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          organizationId,
          employeeCode,
          contactId: input.contactId || null,
          fullName: input.fullName,
          mobile: input.mobile,
          employeeType: input.employeeType,
          status: 'ACTIVE',
          profileNotes: input.profileNotes || null,
          createdById: creatorUserId,
        },
      });

      // 4. Create active branch assignment if assigned
      if (input.branchId) {
        await tx.branchAssignment.create({
          data: {
            employeeId: employee.id,
            branchId: input.branchId,
            effectiveFrom: new Date(),
            isCurrent: true,
            assignedById: creatorUserId,
          },
        });
      }

      // 5. Audit Log creation
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: creatorUserId,
          actorRole: 'ADMIN',
          action: 'EMPLOYEE_CREATED',
          entityType: 'employees',
          entityId: employee.id,
          afterState: {
            employeeCode,
            fullName: employee.fullName,
            employeeType: employee.employeeType,
            branchId: input.branchId || null,
          },
        },
      });

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: user.email,
        mobile: employee.mobile,
        employeeType: employee.employeeType,
        status: employee.status,
      };
    });
  }

  /**
   * Retrieves paginated list of employees with optional branch/status/search filters.
   */
  public async listEmployees(organizationId: string, query: ListEmployeesQuery) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.type && { employeeType: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.branchId && {
        branchAssignments: {
          some: {
            branchId: query.branchId,
            isCurrent: true,
          },
        },
      }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
          { mobile: { contains: query.search } },
        ],
      }),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, lastLoginAt: true } },
          branchAssignments: {
            where: { isCurrent: true },
            include: { branch: { select: { id: true, name: true, branchCode: true } } },
          },
        },
      }),
    ]);

    const formatted = items.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.user.email,
      mobile: emp.mobile,
      employeeType: emp.employeeType,
      status: emp.status,
      assignedBranch: emp.branchAssignments[0]?.branch || null,
      lastLoginAt: emp.user.lastLoginAt,
      createdAt: emp.createdAt,
    }));

    return {
      items: formatted,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Retrieves single employee details with assignment history.
   */
  public async getEmployeeById(employeeId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, lastLoginAt: true } },
        branchAssignments: {
          orderBy: { createdAt: 'desc' },
          include: { branch: true },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee record not found.', 404, 'NOT_FOUND');
    }

    const currentBranch = employee.branchAssignments.find((b) => b.isCurrent)?.branch || null;

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      contactId: employee.contactId,
      fullName: employee.fullName,
      email: employee.user.email,
      mobile: employee.mobile,
      employeeType: employee.employeeType,
      status: employee.status,
      profileNotes: employee.profileNotes,
      currentBranch,
      branchHistory: employee.branchAssignments.map((ba) => ({
        id: ba.id,
        branch: { id: ba.branch.id, name: ba.branch.name, branchCode: ba.branch.branchCode },
        effectiveFrom: ba.effectiveFrom,
        effectiveTo: ba.effectiveTo,
        isCurrent: ba.isCurrent,
      })),
      createdAt: employee.createdAt,
    };
  }

  /**
   * Updates employee profile and transfers branch assignment if branch changed.
   */
  public async updateEmployee(
    updaterUserId: string,
    organizationId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ) {
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      include: { branchAssignments: { where: { isCurrent: true } } },
    });

    if (!existing) {
      throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // Handle branch transfer if provided and different
      if (input.branchId) {
        const currentAssignment = existing.branchAssignments[0];
        if (!currentAssignment || currentAssignment.branchId !== input.branchId) {
          // Close old assignment
          if (currentAssignment) {
            await tx.branchAssignment.update({
              where: { id: currentAssignment.id },
              data: { isCurrent: false, effectiveTo: new Date() },
            });
          }

          // Create new active assignment
          await tx.branchAssignment.create({
            data: {
              employeeId,
              branchId: input.branchId,
              effectiveFrom: new Date(),
              isCurrent: true,
              assignedById: updaterUserId,
            },
          });
        }
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(input.fullName && { fullName: input.fullName }),
          ...(input.mobile && { mobile: input.mobile }),
          ...(input.contactId !== undefined && { contactId: input.contactId }),
          ...(input.profileNotes !== undefined && { profileNotes: input.profileNotes }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: updaterUserId,
          actorRole: 'ADMIN',
          action: 'EMPLOYEE_UPDATED',
          entityType: 'employees',
          entityId: employeeId,
          beforeState: { fullName: existing.fullName, mobile: existing.mobile },
          afterState: { fullName: updated.fullName, mobile: updated.mobile },
        },
      });

      return updated;
    });
  }

  /**
   * Updates employee status (ACTIVE, SUSPENDED, DEACTIVATED).
   */
  public async updateEmployeeStatus(
    updaterUserId: string,
    organizationId: string,
    employeeId: string,
    input: UpdateEmployeeStatusInput
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      include: { user: true },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const isUserActive = input.status === 'ACTIVE';

      // Update employee
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { status: input.status },
      });

      // Synchronize User login status
      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: isUserActive },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: updaterUserId,
          actorRole: 'ADMIN',
          action: `EMPLOYEE_STATUS_${input.status}`,
          entityType: 'employees',
          entityId: employeeId,
          beforeState: { status: employee.status },
          afterState: { status: input.status, reason: input.reason },
        },
      });

      return updated;
    });
  }
}

export const employeeService = new EmployeeService();

