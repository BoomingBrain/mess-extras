import { newBatch, usableGrams, consumeFifo, expireBatches } from './stock';
import { paneer, batch } from '../test/fixtures';

describe('stock', () => {
  it('newBatch sets expiresOn from shelf life', () => {
    const b = newBatch({ id: 'x', item: paneer, grams: 500, purchasedOn: '2026-11-17' });
    expect(b).toMatchObject({ gramsInitial: 500, gramsRemaining: 500, expiresOn: '2026-11-20', writtenOffAt: null });
  });

  it('a batch is usable up to and including its expiry date', () => {
    const b = [batch({ purchasedOn: '2026-11-17', expiresOn: '2026-11-20' })];
    expect(usableGrams(b, paneer.id, '2026-11-20')).toBe(1000);
    expect(usableGrams(b, paneer.id, '2026-11-21')).toBe(0);
  });

  it('excludes written-off batches and other items', () => {
    const b = [
      batch({ id: 'a', writtenOffAt: '2026-11-19T00:00:00Z' }),
      batch({ id: 'b', itemId: 'item-chicken' }),
      batch({ id: 'c', gramsRemaining: 300 }),
    ];
    expect(usableGrams(b, paneer.id, '2026-11-19')).toBe(300);
  });

  it('consumes the oldest batch first without mutating input', () => {
    const b = [
      batch({ id: 'new', gramsInitial: 2000, gramsRemaining: 2000, purchasedOn: '2026-11-19' }),
      batch({ id: 'old', gramsRemaining: 1000, purchasedOn: '2026-11-17', expiresOn: '2026-11-20' }),
    ];
    const before = structuredClone(b);
    const r = consumeFifo(b, paneer.id, 1500, '2026-11-19');
    expect(r.consumed).toBe(1500);
    expect(r.batches.find((x) => x.id === 'old')!.gramsRemaining).toBe(0);
    expect(r.batches.find((x) => x.id === 'new')!.gramsRemaining).toBe(1500);
    expect(b).toEqual(before);
  });

  it('consumes at most what is usable', () => {
    const r = consumeFifo([batch({ gramsRemaining: 400 })], paneer.id, 1000, '2026-11-19');
    expect(r.consumed).toBe(400);
  });

  it('writes off expired batches and reports the grams', () => {
    const b = [batch({ id: 'e', gramsRemaining: 700, expiresOn: '2026-11-18' }), batch({ id: 'k' })];
    const r = expireBatches(b, '2026-11-19', '2026-11-19T03:30:00.000Z');
    expect(r.expiredGrams).toBe(700);
    expect(r.batches.find((x) => x.id === 'e')!.writtenOffAt).toBe('2026-11-19T03:30:00.000Z');
    expect(r.batches.find((x) => x.id === 'k')!.writtenOffAt).toBeNull();
  });
});
