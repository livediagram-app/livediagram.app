import { describe, expect, it } from 'vitest';
import { wearsSaved } from './saved-designs';

// docs/specs/011-theme/page-designs.md "Saved designs": the saved tile a tab or page wears shows selected.
describe('wearing a saved design', () => {
  const saved = { id: 'aurora' as const, scale: 1.4, flow: true as const };

  it('matches the tab’s design as saved, switches and all', () => {
    expect(wearsSaved({ id: 'aurora', scale: 1.4, flow: true }, saved, false)).toBe(true);
    expect(wearsSaved({ id: 'aurora', scale: 1.4 }, saved, false)).toBe(false);
    expect(wearsSaved({ id: 'aurora', scale: 1.2, flow: true }, saved, false)).toBe(false);
  });

  it('matches a page’s own design without the tab’s switches, and nothing when none is worn', () => {
    expect(wearsSaved({ id: 'aurora', scale: 1.4 }, saved, true)).toBe(true);
    expect(wearsSaved(undefined, saved, true)).toBe(false);
  });
});
