import { PrismaClient, EmployeeType } from '@prisma/client';

/**
 * Generates sequential, collision-free employee codes like LABA-OS-001 or LABA-FS-001.
 */
export async function generateNextEmployeeCode(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  employeeType: EmployeeType
): Promise<string> {
  const prefix = employeeType === 'FIELD_STAFF' ? 'LABA-FS' : 'LABA-OS';

  const count = await tx.employee.count({
    where: {
      employeeType,
    },
  });

  const nextSeq = (count + 1).toString().padStart(3, '0');
  const candidateCode = `${prefix}-${nextSeq}`;

  // Check if candidate exists, if so increment sequence
  const existing = await tx.employee.findUnique({
    where: { employeeCode: candidateCode },
  });

  if (!existing) {
    return candidateCode;
  }

  // Fallback timestamp suffix if collision occurs
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${nextSeq}-${randomSuffix}`;
}

