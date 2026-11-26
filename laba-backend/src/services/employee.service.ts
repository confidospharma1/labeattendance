import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateNextEmployeeCode } from '../utils/idGenerator';
import { AppError } from '../utils/AppError';
import { CreateEmployeeInput, UpdateEmployeeInput, UpdateEmployeeStatusInput, ListEmployeesQuery } from '../schemas/employee.schema';
import { Prisma, StaffCategory } from '@prisma/client';
import { attendanceModeFor, modeNeedsLocation, roleForCategory, CATEGORY_LABEL } from '../utils/staff';

const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
const ymd = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const branchSelect = { id: true, name: true, branchCode: true, locationType: true, district: true } as const;

export class EmployeeService {
  /** Login role for the employee: from the staff category, or the explicit type for admins / legacy staff. */
  private resolveType(employeeType: string | undefined, category: StaffCategory | null | undefined) {
    if (employeeType === 'ADMIN' || employeeType === 'SUPER_ADMIN') return employeeType;
    if (category) return roleForCategory(category);
    return (employeeType as 'OFFICE_STAFF' | 'FIELD_STAFF') ?? 'OFFICE_STAFF';
  }

  private async assertShift(organizationId: string, shiftId?: string | null) {
    if (!shiftId) return;
    const shift = await prisma.shift.findFirst({ where: { id: shiftId, organizationId } });
    if (!shift) throw new AppError('Selected shift not found.', 404, 'SHIFT_NOT_FOUND');
  }

  private async assertCodeFree(employeeCode: string, exceptId?: string) {
    const existing = await prisma.employee.findUnique({ where: { employeeCode }, select: { id: true } });
    if (existing && existing.id !== exceptId) {
      throw new AppError(`Employee code ${employeeCode} is already in use.`, 409, 'DUPLICATE_EMPLOYEE_CODE');
    }
  }

  /**
   * Creates an employee, corresponding user credentials, and active branch assignment in one atomic transaction.
   */
  public async createEmployee(creatorUserId: string, organizationId: string, input: CreateEmployeeInput) {
    const category = input.employeeType === 'ADMIN' ? null : (input.staffCategory ?? null);
    const employeeType = this.resolveType(input.employeeType, category);
    const branchId = input.branchId || null;
    const shiftId = input.shiftId || null;
    const mode = attendanceModeFor(employeeType, category);

    // Office-type staff and sales executives need a work location (office / DC / pharmacy / lab)
    if (employeeType !== 'ADMIN' && modeNeedsLocation(mode) && !branchId) {
      throw new AppError(
        mode === 'TERRITORY'
          ? 'Sales executives must be allotted to a distribution centre.'
          : 'This staff category requires a work location (office, DC, pharmacy or lab).',
        400,
        'BRANCH_REQUIRED'
      );
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId, isActive: true },
      });
      if (!branch) {
        throw new AppError('Specified work location not found or inactive.', 404, 'BRANCH_NOT_FOUND');
      }
    }
    await this.assertShift(organizationId, shiftId);
    if (input.employeeCode) await this.assertCodeFree(input.employeeCode);

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      // 1. Create User authentication record
      const user = await tx.user.create({
        data: {
          organizationId,
          email: input.email,
          passwordHash,
          role: employeeType,
        },
      });

      // 2. Employee code: admin-supplied (HR code) or generated per category
      const employeeCode = input.employeeCode || (await generateNextEmployeeCode(tx, employeeType, category));

      // 3. Create Employee profile record
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          organizationId,
          employeeCode,
          contactId: input.contactId || null,
          fullName: input.fullName,
          mobile: input.mobile,
          employeeType,
          staffCategory: category,
          designation: input.designation || null,
          dateOfJoining: toDate(input.dateOfJoining),
          shiftId,
          status: 'ACTIVE',
          profileNotes: input.profileNotes || null,
          createdById: creatorUserId,
        },
      });

      // 4. Create active branch assignment if assigned
      if (branchId) {
        await tx.branchAssignment.create({
          data: {
            employeeId: employee.id,
            branchId,
            effectiveFrom: new Date(),
            isCurrent: true,
            assignedById: creatorUserId,
          },
        });
      }


      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: user.email,
        mobile: employee.mobile,
        employeeType: employee.employeeType,
        staffCategory: employee.staffCategory,
        status: employee.status,
      };
    });
  }

  /**
   * Retrieves paginated list of employees with optional branch/status/category/search filters.
   */
  public async listEmployees(organizationId: string, query: ListEmployeesQuery) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.type && { employeeType: query.type }),
      ...(query.category && { staffCategory: query.category }),
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
          { designation: { contains: query.search, mode: 'insensitive' } },
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
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          branchAssignments: {
            where: { isCurrent: true },
            include: { branch: { select: branchSelect } },
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
      staffCategory: emp.staffCategory,
      categoryLabel: emp.staffCategory ? CATEGORY_LABEL[emp.staffCategory] : null,
      designation: emp.designation,
      dateOfJoining: ymd(emp.dateOfJoining),
      shift: emp.shift,
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
        shift: true,
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
      staffCategory: employee.staffCategory,
      designation: employee.designation,
      dateOfJoining: ymd(employee.dateOfJoining),
      shift: employee.shift,
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
      include: { user: true, branchAssignments: { where: { isCurrent: true } } },
    });

    if (!existing) {
      throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    }

    // Category drives the login role; switching to ADMIN clears the category.
    const category =
      input.employeeType === 'ADMIN' || input.employeeType === 'SUPER_ADMIN'
        ? null
        : input.staffCategory !== undefined
          ? input.staffCategory
          : existing.staffCategory;
    const nextType =
      input.staffCategory !== undefined || input.employeeType !== undefined
        ? this.resolveType(input.employeeType ?? existing.employeeType, category)
        : existing.employeeType;
    const shiftId = input.shiftId === '' ? null : input.shiftId;
    await this.assertShift(organizationId, shiftId);
    if (input.employeeCode && input.employeeCode !== existing.employeeCode) {
      await this.assertCodeFree(input.employeeCode, employeeId);
    }
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: input.branchId, organizationId, isActive: true } });
      if (!branch) throw new AppError('Specified work location not found or inactive.', 404, 'BRANCH_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // Handle branch transfer if provided and different
      if (input.branchId !== undefined) {
        const currentAssignment = existing.branchAssignments[0];
        if (input.branchId === null && currentAssignment) {
          await tx.branchAssignment.update({
            where: { id: currentAssignment.id },
            data: { isCurrent: false, effectiveTo: new Date() },
          });
        } else if (input.branchId && (!currentAssignment || currentAssignment.branchId !== input.branchId)) {
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

      // If email or role is updated, update the user account
      if (input.email || nextType !== existing.employeeType) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(input.email && { email: input.email }),
            ...(nextType !== existing.employeeType && { role: nextType }),
          },
        });
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(input.fullName && { fullName: input.fullName }),
          ...(input.mobile && { mobile: input.mobile }),
          ...(nextType !== existing.employeeType && { employeeType: nextType }),
          ...((input.staffCategory !== undefined || nextType !== existing.employeeType) && { staffCategory: category }),
          ...(input.designation !== undefined && { designation: input.designation || null }),
          ...(input.dateOfJoining !== undefined && { dateOfJoining: toDate(input.dateOfJoining) }),
          ...(input.employeeCode && { employeeCode: input.employeeCode }),
          ...(shiftId !== undefined && { shiftId }),
          ...(input.status && { status: input.status }),
          ...(input.contactId !== undefined && { contactId: input.contactId }),
          ...(input.profileNotes !== undefined && { profileNotes: input.profileNotes }),
        },
      });


      return updated;
    });
  }


  /**
   * Permanently deletes employee and associated records from the entire database.
   */
  public async deleteEmployee(
    deleterUserId: string,
    organizationId: string,
    employeeId: string
  ) {
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      include: { user: true },
    });

    if (!existing) {
      throw new AppError('Employee not found in organization.', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Unlink managed branches
      await tx.branch.updateMany({
        where: { managerEmployeeId: employeeId },
        data: { managerEmployeeId: null },
      });

      // 2. Delete attendance corrections
      await tx.attendanceCorrection.deleteMany({
        where: { employeeId },
      });

      // 3. Delete attendance records
      await tx.attendanceRecord.deleteMany({
        where: { employeeId },
      });

      // 4. Delete field tasks and face profile
      await tx.fieldTask.deleteMany({
        where: { employeeId },
      });
      await tx.faceProfile.deleteMany({
        where: { employeeId },
      });

      // 5. Delete branch assignments
      await tx.branchAssignment.deleteMany({
        where: { employeeId },
      });

      // 6. Delete employee profile
      await tx.employee.delete({
        where: { id: employeeId },
      });

      // 7. Keep customers this person added (reassign to the admin), then delete the linked user account
      await tx.customer.updateMany({ where: { addedById: existing.userId }, data: { addedById: deleterUserId } });
      await tx.user.delete({
        where: { id: existing.userId },
      });


      return { success: true, message: `Employee ${existing.fullName} (${existing.employeeCode}) was permanently removed.` };
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


      return updated;
    });
  }
}

export const employeeService = new EmployeeService();

