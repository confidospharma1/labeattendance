import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { isCoordinateWithinIndia } from '../utils/haversine';
import { CreateBranchInput, UpdateBranchInput, ListBranchesQuery } from '../schemas/branch.schema';
import { Prisma } from '@prisma/client';

/** Geofence / territory columns from create or update input. Shape CIRCLE clears a stored boundary. */
type FenceData = Pick<
  Prisma.BranchUncheckedCreateInput,
  'locationType' | 'geofenceShape' | 'boundary' | 'boundaryLabel' | 'territory' | 'territoryLabel'
>;
const asJson = (g: unknown) => g as Prisma.InputJsonValue;

function fenceData(input: Partial<CreateBranchInput>): FenceData {
  const data: FenceData = {};
  if (input.locationType) data.locationType = input.locationType;
  if (input.geofenceShape === 'POLYGON') {
    data.geofenceShape = 'POLYGON';
    data.boundary = asJson(input.boundary);
    data.boundaryLabel = input.boundaryLabel || null;
  } else if (input.geofenceShape === 'CIRCLE') {
    data.geofenceShape = 'CIRCLE';
    data.boundary = Prisma.DbNull;
    data.boundaryLabel = null;
  }
  if (input.territory !== undefined) {
    data.territory = input.territory ? asJson(input.territory) : Prisma.DbNull;
    data.territoryLabel = input.territory ? input.territoryLabel || null : null;
  }
  return data;
}

/** Lightweight list row: boundaries are only flagged (the full GeoJSON is fetched per branch). */
const fenceSummary = (b: { locationType: string; geofenceShape: string; boundaryLabel: string | null; territory: unknown; territoryLabel: string | null; boundary: unknown }) => ({
  locationType: b.locationType,
  geofenceShape: b.geofenceShape,
  boundaryLabel: b.boundaryLabel,
  hasBoundary: !!b.boundary,
  territoryLabel: b.territoryLabel,
  hasTerritory: !!b.territory,
});

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

    // Handle or auto-generate branchCode
    let branchCode = input.branchCode ? input.branchCode.trim().toUpperCase() : '';
    if (!branchCode) {
      const branchCount = await prisma.branch.count({ where: { organizationId } });
      const nextNum = (branchCount + 1).toString().padStart(3, '0');
      branchCode = `JT-L-${nextNum}`;
      // Verify collision
      const duplicate = await prisma.branch.findFirst({ where: { branchCode } });
      if (duplicate) {
        branchCode = `JT-L-${nextNum}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } else {
      const existing = await prisma.branch.findFirst({
        where: { branchCode, organizationId },
      });
      if (existing) {
        throw new AppError(
          `Branch code '${branchCode}' is already registered. Please enter a different code or leave blank to auto-generate.`,
          409,
          'DUPLICATE_BRANCH_CODE'
        );
      }
    }

    const branch = await prisma.branch.create({
      data: {
        organizationId,
        branchCode,
        name: input.name,
        address: input.address,
        district: input.district,
        state: input.state || 'Andhra Pradesh',
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        geofenceRadiusMetres: input.geofenceRadiusMetres,
        ...fenceData(input),
        managerEmployeeId: input.managerEmployeeId || null,
        createdById: creatorUserId,
      },
      include: {
        manager: {
          select: { id: true, fullName: true, employeeCode: true },
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
      ...(query.locationType && { locationType: query.locationType }),
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
      ...fenceSummary(b),
      isActive: b.isActive,
      manager: b.manager,
      activeEmployeeCount: b._count.assignments,
      createdAt: b.createdAt,
    }));

    return {
      items: formatted,
      branches: formatted,
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
   * Updates branch details, coordinates, or geofence boundary.
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
        ...fenceData(input),
      },
    });


    return {
      ...updated,
      latitude: updated.latitude.toNumber(),
      longitude: updated.longitude.toNumber(),
    };
  }

  /**
   * Permanently deletes a pharmacy branch and unlinks staff assignments.
   */
  public async deleteBranch(
    deleterUserId: string,
    organizationId: string,
    branchId: string
  ) {
    const existing = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });

    if (!existing) {
      throw new AppError('Branch not found in organization.', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Delete branch assignments
      await tx.branchAssignment.deleteMany({
        where: { branchId },
      });

      // 2. Delete branch record
      await tx.branch.delete({
        where: { id: branchId },
      });


      return {
        success: true,
        message: `Branch ${existing.name} (${existing.branchCode}) was permanently removed.`,
      };
    });
  }
}

export const branchService = new BranchService();

