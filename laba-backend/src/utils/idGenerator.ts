import { PrismaClient, EmployeeType, StaffCategory } from '@prisma/client';
import { codePrefixFor } from './staff';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Generates sequential, collision-free employee codes per staff category,
 * e.g. LABE-HO-001 (head office), LABE-SE-004 (sales executive), LABE-OS-002 (legacy office staff).
 */
export async function generateNextEmployeeCode(
  tx: Tx,
  employeeType: EmployeeType,
  category?: StaffCategory | null
): Promise<string> {
  const prefix = codePrefixFor(employeeType, category);
  const count = await tx.employee.count({ where: { employeeCode: { startsWith: `${prefix}-` } } });

  for (let seq = count + 1; seq < count + 50; seq++) {
    const candidate = `${prefix}-${seq.toString().padStart(3, '0')}`;
    const existing = await tx.employee.findUnique({ where: { employeeCode: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}
