import { describeTask } from '../../src/services/fieldTask.service';
import { faceSimilarity, bestFaceSimilarity } from '../../src/utils/faceMatch';
import { istDateTimeFromWorkDate } from '../../src/utils/timeWindows';

const baseTask = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 't1',
    organizationId: 'o',
    employeeId: 'e',
    taskDate: new Date('2026-11-22T00:00:00.000Z'),
    sequence: 1,
    title: 'Visit',
    description: null,
    locationName: 'Shop',
    address: null,
    latitude: 14.47 as any,
    longitude: 78.82 as any,
    radiusMetres: 100,
    deadlineTime: '17:00',
    status: 'PENDING',
    lateAccessStatus: 'NONE',
    lateAccessUntil: null,
    visitSelfie: null,
    ...overrides,
  }) as any;

describe('istDateTimeFromWorkDate', () => {
  it('converts IST wall time to UTC', () => {
    const d = istDateTimeFromWorkDate(new Date('2026-11-22T00:00:00.000Z'), '17:00');
    expect(d.toISOString()).toBe('2026-11-22T11:30:00.000Z');
  });
});

describe('describeTask', () => {
  it('allows a visit before the deadline on the task day', () => {
    const info = describeTask(baseTask(), new Date('2026-11-22T05:00:00.000Z')); // 10:30 IST
    expect(info.canVisit).toBe(true);
    expect(info.displayStatus).toBe('PENDING');
  });

  it('does not allow starting a future task', () => {
    const info = describeTask(baseTask(), new Date('2026-11-21T10:00:00.000Z'));
    expect(info.notStarted).toBe(true);
    expect(info.canVisit).toBe(false);
  });

  it('marks overdue tasks MISSED and allows a late request', () => {
    const info = describeTask(baseTask(), new Date('2026-11-22T12:00:00.000Z')); // 17:30 IST
    expect(info.displayStatus).toBe('MISSED');
    expect(info.canVisit).toBe(false);
    expect(info.canRequestLate).toBe(true);
  });

  it('re-opens an overdue task while admin late access is active', () => {
    const now = new Date('2026-11-22T12:00:00.000Z');
    const info = describeTask(
      baseTask({ lateAccessStatus: 'APPROVED', lateAccessUntil: new Date(now.getTime() + 3600_000) }),
      now
    );
    expect(info.lateAccessActive).toBe(true);
    expect(info.canVisit).toBe(true);
    expect(info.canRequestLate).toBe(false);
  });

  it('blocks a second late request while one is pending', () => {
    const info = describeTask(baseTask({ lateAccessStatus: 'REQUESTED' }), new Date('2026-11-22T12:00:00.000Z'));
    expect(info.canRequestLate).toBe(false);
  });
});

describe('faceSimilarity', () => {
  const vec = (seed: number) => Array.from({ length: 1024 }, (_, i) => Math.sin(i * seed) * 0.5);

  it('is 1 for identical descriptors', () => {
    const a = vec(1);
    expect(faceSimilarity(a, a)).toBe(1);
  });

  it('is lower for different descriptors', () => {
    expect(faceSimilarity(vec(1), vec(7))).toBeLessThan(0.5);
  });

  it('rejects mismatched lengths', () => {
    expect(faceSimilarity(vec(1), vec(1).slice(0, 512))).toBe(0);
  });

  it('takes the best of several enrolled samples', () => {
    expect(bestFaceSimilarity(vec(1), [vec(7), vec(1)])).toBe(1);
  });
});
