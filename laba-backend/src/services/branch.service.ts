import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { isCoordinateWithinIndia } from '../utils/haversine';
import { CreateBranchInput, UpdateBranchInput, ListBranchesQuery } from '../schemas/branch.schema';
import { Prisma } from '@prisma/client';

export class BranchService {
  /**
   * Registers a new pharmacy branch with GPS anchor point and geofence radius.
   */
  public async createBranch(creatorUserId: string, organizationId: string, input: CreateBranchInput) {
    if (!isCoordinateWithinIndia(input.latitude, input.longitude)) {
      throw new AppError(
        'GPS coordinates must fall within the geographic boundaries of India.',
        400,
        'INVALID_COORDINATES'
      );
    }

    // Check duplicate branch code
    const existing = await prisma.branch.findFirst({
      where: { branchCode: input.branchCode, organizationId },
    });
    if (existing) {
      throw new AppError(`Branch code '${input.branchCode}' is already registered.`, 409, 'DUPLICATE_BRANCH_CODE');
    }

    const branch = await prisma.branch.create({
      data: {
        organizationId,
        branchCode: input.branchCode,
        name: input.name,
        address: input.address,
        district: input.district,
        state: input.state || 'Andhra Pradesh',
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        geofenceRadiusMetres: input.geofenceRadiusMetres,
        managerEmployeeId: input.managerEmployeeId || null,
        createdById: creatorUserId,
      },
      include: {
        manager: {
          select: { id: true, fullName: true, employeeCode: true },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: creatorUserId,
        actorRole: 'ADMIN',
        action: 'BRANCH_CREATED',
        entityType: 'branches',
        entityId: branch.id,
        afterState: {
          name: branch.name,
          branchCode: branch.branchCode,
          latitude: input.latitude,
          longitude: input.longitude,
          geofenceRadiusMetres: branch.geofenceRadiusMetres,
        },
      },
    });

    return branch;
  }

  /**
   * Lists all pharmacy branches with employee count.
   */
  public async listBranches(organizationId: string, query: ListBranchesQuery) {
    const where: Prisma.BranchWhereInput = {
      organizationId,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { branchCode: { contains: query.search, mode: 'insensitive' } },
          { district: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await Promise.all([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          manager: {
            select: { id: true, fullName: true, employeeCode: true },
          },
          _count: {
            select: {
              assignments: {
                where: { isCurrent: true },
              },
            },
          },
        },
      }),
    ]);

    const formatted = items.map((b) => ({
      id: b.id,
      branchCode: b.branchCode,
      name: b.name,
      address: b.address,
      district: b.district,
      state: b.state,
      latitude: b.latitude.toNumber(),
      longitude: b.longitude.toNumber(),
      geofenceRadiusMetres: b.geofenceRadiusMetres,
      isActive: b.isActive,
      manager: b.manager,
      activeEmployeeCount: b._count.assignments,
      createdAt: b.createdAt,
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
   * Retrieves single branch details.
   */
  public async getBranchById(branchId: string, organizationId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      include: {
        manager: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        assignments: {
          where: { isCurrent: true },
          include: {
            employee: {
              select: { id: true, fullName: true, employeeCode: true, mobile: true },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new AppError('Branch not found.', 404, 'NOT_FOUND');
    }

    return {
      ...branch,
      latitude: branch.latitude.toNumber(),
      longitude: branch.longitude.toNumber(),
      activeEmployees: branch.assignments.map((a) => a.employee),
    };
  }

  /**
   * Updates branch details, coordinates, or geofence boundary with historical coordinate audit log.
   */
  public async updateBranch(
    updaterUserId: string,
    organizationId: string,
    branchId: string,
    input: UpdateBranchInput
  ) {
    const existing = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });

    if (!existing) {
      throw new AppError('Branch not found.', 404, 'NOT_FOUND');
    }

    if (input.latitude !== undefined && input.longitude !== undefined) {
      if (!isCoordinateWithinIndia(input.latitude, input.longitude)) {
        throw new AppError(
          'Coordinates must be located within India boundaries.',
          400,
          'INVALID_COORDINATES'
        );
      }
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.address && { address: input.address }),
        ...(input.district && { district: input.district }),
        ...(input.state && { state: input.state }),
        ...(input.latitude !== undefined && { latitude: new Prisma.Decimal(input.latitude) }),
        ...(input.longitude !== undefined && { longitude: new Prisma.Decimal(input.longitude) }),
        ...(input.geofenceRadiusMetres !== undefined && { geofenceRadiusMetres: input.geofenceRadiusMetres }),
        ...(input.managerEmployeeId !== undefined && { managerEmployeeId: input.managerEmployeeId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    // Record audit log if coordinates or radius changed
    const coordsChanged =
      (input.latitude !== undefined && input.latitude !== existing.latitude.toNumber()) ||
      (input.longitude !== undefined && input.longitude !== existing.longitude.toNumber()) ||
      (input.geofenceRadiusMetres !== undefined && input.geofenceRadiusMetres !== existing.geofenceRadiusMetres);

    if (coordsChanged) {
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: updaterUserId,
          actorRole: 'ADMIN',
          action: 'BRANCH_GPS_UPDATED',
          entityType: 'branches',
          entityId: branchId,
          beforeState: {
            latitude: existing.latitude.toNumber(),
            longitude: existing.longitude.toNumber(),
            geofenceRadiusMetres: existing.geofenceRadiusMetres,
          },
          afterState: {
            latitude: updated.latitude.toNumber(),
            longitude: updated.longitude.toNumber(),
            geofenceRadiusMetres: updated.geofenceRadiusMetres,
          },
        },
      });
    }

    return {
      ...updated,
      latitude: updated.latitude.toNumber(),
      longitude: updated.longitude.toNumber(),
    };
  }
}

export const branchService = new BranchService();

