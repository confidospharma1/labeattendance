import { hashPassword, comparePassword, signToken, verifyToken } from '../../src/utils/auth';

describe('Auth Utilities: Hashing & JWT', () => {
  it('should hash password and verify match correctly', async () => {
    const raw = 'SecurePassword123';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2b$')).toBe(true);

    const matches = await comparePassword(raw, hash);
    expect(matches).toBe(true);

    const wrong = await comparePassword('WrongPassword456', hash);
    expect(wrong).toBe(false);
  });

  it('should sign and verify JWT payload integrity', () => {
    const payload = {
      userId: 'test-user-uuid',
      organizationId: 'test-org-uuid',
      role: 'OFFICE_STAFF',
      employeeId: 'test-emp-uuid',
    };

    const token = signToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.organizationId).toBe(payload.organizationId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.employeeId).toBe(payload.employeeId);
  });
});

