import { describe, expect, it } from 'vitest';
import {
  panelSectionGroups,
  resolveSection,
  sectionFromKey,
  sectionKey,
  sectionLabel,
  sectionPage,
  sectionTelemetryRow,
} from './panel-sections';

// docs/specs/013-workspace/explorer-structure.md "The rail": every section a mode of the pane.
const groups = panelSectionGroups({ teams: [{ id: 't1' }], hasBrowserDocuments: true });

describe('the editor Explorer sections', () => {
  it("lists the sidebar's groups, This browser only while it holds documents", () => {
    expect(groups.map((g) => g.sections.map(sectionKey))).toEqual([
      ['home', 'inbox', 'timeline', 'shared'],
      ['mine', 'team:t1'],
      ['browser', 'library', 'trash'],
    ]);
    const none = panelSectionGroups({ teams: [], hasBrowserDocuments: false });
    expect(none[2]!.sections.map(sectionKey)).toEqual(['library', 'trash']);
  });

  it('round-trips a key, and refuses one it does not know', () => {
    for (const s of groups.flatMap((g) => g.sections))
      expect(sectionFromKey(sectionKey(s))).toEqual(s);
    expect(sectionFromKey('nope')).toBeNull();
    expect(sectionFromKey('team:')).toBeNull();
    expect(sectionFromKey(null)).toBeNull();
  });

  it('names each section, a team by its name', () => {
    expect(sectionLabel({ kind: 'mine' })).toBe('My documents');
    expect(sectionLabel({ kind: 'team', id: 't1' }, () => 'Design guild')).toBe('Design guild');
    expect(sectionLabel({ kind: 'team', id: 't1' })).toBe('Team');
  });

  it('opens each section on its Explorer page', () => {
    expect(sectionPage({ kind: 'mine' })).toEqual({ kind: 'all' });
    expect(sectionPage({ kind: 'browser' })).toEqual({ kind: 'offline' });
    expect(sectionPage({ kind: 'library' })).toEqual({ kind: 'gallery' });
    expect(sectionPage({ kind: 'team', id: 't1' })).toEqual({ kind: 'team', id: 't1' });
    expect(sectionPage({ kind: 'inbox' })).toEqual({ kind: 'inbox' });
  });

  it('reports a closed row kind, never a name or id', () => {
    expect(sectionTelemetryRow({ kind: 'team', id: 'secret' })).toBe('Team');
    expect(sectionTelemetryRow({ kind: 'shared' })).toBe('SharedWithMe');
  });

  it('shows the remembered section while it exists, else Home', () => {
    expect(resolveSection({ remembered: { kind: 'inbox' }, groups })).toEqual({ kind: 'inbox' });
    // A team left since it was remembered.
    expect(resolveSection({ remembered: { kind: 'team', id: 'gone' }, groups })).toEqual({
      kind: 'home',
    });
    expect(resolveSection({ remembered: null, groups })).toEqual({ kind: 'home' });
  });
});
