import { retentionService } from '../../src/services/retention.service';

// verifyToken is private: it guards "delete only after the archive was downloaded".
const verify = (org: string, through: string, token: string) => (retentionService as any).verifyToken(org, through, token);

describe('Retention: archive token', () => {
  const org = '11111111-1111-1111-1111-111111111111';

  it('accepts the token issued for the same organisation and date', () => {
    const token = retentionService.archiveToken(org, '2026-08-27');
    expect(() => verify(org, '2026-08-27', token)).not.toThrow();
  });

  it('rejects a token for a different date or organisation', () => {
    const token = retentionService.archiveToken(org, '2026-08-27');
    expect(() => verify(org, '2026-08-29', token)).toThrow(/Download the Excel archive/);
    expect(() => verify('22222222-2222-2222-2222-222222222222', '2026-08-27', token)).toThrow();
  });

  it('rejects forged and expired tokens', () => {
    expect(() => verify(org, '2026-08-27', `${Date.now()}.deadbeef`)).toThrow();
    expect(() => verify(org, '2026-08-27', 'garbage')).toThrow(/expired/);
    const old = Date.now() - 31 * 60_000;
    const sig = (retentionService as any).sign(org, '2026-08-27', old);
    expect(() => verify(org, '2026-08-27', `${old}.${sig}`)).toThrow(/expired/);
  });
});
