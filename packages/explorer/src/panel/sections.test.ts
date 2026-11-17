import { describe, expect, it } from 'vitest';
import { panelSectionGroups, resolveSection, sectionFromKey } from './sections';

describe('the panel’s remembered section', () => {
  it('reads each key it wrote, and none it does not know', () => {
    expect(sectionFromKey('mine')).toEqual({ kind: 'mine' });
    expect(sectionFromKey('team:t1')).toEqual({ kind: 'team', id: 't1' });
    expect(sectionFromKey('team:')).toBeNull();
    expect(sectionFromKey('nope')).toBeNull();
    expect(sectionFromKey(null)).toBeNull();
  });

  // Favourites were removed (one-explorer.md "Favourites removed"): a panel left on it opens on My Work.
  it('opens My Work for a remembered Favourites, which the rail no longer lists', () => {
    const groups = panelSectionGroups([]);
    expect(groups.flatMap((g) => g.sections.map((s) => s.kind))).not.toContain('favourites');
    expect(resolveSection(sectionFromKey('favourites'), groups)).toEqual({ kind: 'mine' });
  });
});
