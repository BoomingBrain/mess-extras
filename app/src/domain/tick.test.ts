import { planTick } from './tick';
import { istAt } from './time';
import { paneer, chicken, offering } from '../test/fixtures';

const thu = (hhmm: string) => istAt('2026-11-19', hhmm);
const items = [paneer, chicken];
const none = new Set<string>();

describe('planTick', () => {
  it('at 09:00 Thursday creates only the paneer offering, after expiring stock', () => {
    expect(planTick({ now: thu('09:00'), items, offerings: [], sentKeys: none })).toEqual([
      { kind: 'expireStock', date: '2026-11-19' },
      { kind: 'createOffering', itemId: paneer.id, date: '2026-11-19' },
    ]);
  });
  it('reminds at 16:05 once', () => {
    const offs = [offering()];
    expect(planTick({ now: thu('16:05'), items, offerings: offs, sentKeys: none })).toContainEqual({ kind: 'remind', offeringId: 'off-1' });
    const sent = new Set(['reminder:2026-11-19:item-paneer']);
    expect(planTick({ now: thu('16:05'), items, offerings: offs, sentKeys: sent }).some((a) => a.kind === 'remind')).toBe(false);
  });
  it('closes at 17:00 and does not remind after close time', () => {
    const acts = planTick({ now: thu('17:00'), items, offerings: [offering()], sentKeys: none });
    expect(acts).toContainEqual({ kind: 'close', offeringId: 'off-1' });
    expect(acts.some((a) => a.kind === 'remind')).toBe(false);
  });
  it('closes a missed open offering from yesterday', () => {
    const y = offering({ id: 'y', date: '2026-11-18' });
    expect(planTick({ now: thu('09:00'), items, offerings: [y], sentKeys: none })).toContainEqual({ kind: 'close', offeringId: 'y' });
  });
  it('never reopens or recreates a closed offering when the clock goes back', () => {
    const acts = planTick({ now: thu('09:00'), items, offerings: [offering({ status: 'closed' })], sentKeys: none });
    expect(acts).toEqual([{ kind: 'expireStock', date: '2026-11-19' }]);
  });
  it('ignores inactive items', () => {
    const acts = planTick({ now: thu('09:00'), items: [{ ...paneer, active: false }], offerings: [], sentKeys: none });
    expect(acts).toEqual([{ kind: 'expireStock', date: '2026-11-19' }]);
  });
});
