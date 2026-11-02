import { describe, expect, it } from 'vitest';
import { participantTabChange, type Tab } from '@livedocuments/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { findMatches } from './find-matches';
import { replaceInTab } from './find-replace';
import { findTargets } from './find-targets';
import { DEFAULT_FIND_OPTIONS } from './find-text';
import { fixtureTab, rowsOf } from '@/test/find-fixture';

// docs/specs/007-editor/find-and-replace.md "Share roles": everyone finds; an Editor replaces anywhere, a Participant
// only in the text it may write, a Viewer nowhere. Replace All as each role would run it.
function replaceAllAs(level: 'edit' | 'participate' | 'view', tab: Tab, query: string, by: string) {
  const scope = resolveEditorCapabilities(level).replace;
  const targets = findTargets(tab, rowsOf(tab), { scope });
  const { matches } = findMatches(targets, query, DEFAULT_FIND_OPTIONS);
  return { ...replaceInTab(tab, targets, matches, by), found: matches.length };
}

describe('find and replace by share role', () => {
  const tab = fixtureTab();

  it('lets every role find every match', () => {
    const found = (['edit', 'participate', 'view'] as const).map(
      (level) => replaceAllAs(level, tab, 'plan', 'map').found,
    );
    expect(new Set(found).size).toBe(1);
    expect(found[0]).toBeGreaterThan(10);
  });

  it('lets an Editor replace everything it finds', () => {
    const out = replaceAllAs('edit', tab, 'plan', 'map');
    expect(out.held).toBe(0);
    expect(out.count).toBe(out.found);
  });

  it("lets a Participant replace only its text, as a change the room's rule takes whole", () => {
    const out = replaceAllAs('participate', tab, 'plan', 'map');
    expect(out.held).toBe(1);
    expect(out.count).toBe(out.found - 1);
    // The editor's side of the room's rule: the change lands as it is, nothing trimmed or refused.
    expect(participantTabChange(tab, out.tab)).toBe(out.tab);
  });

  it('would have the room refuse what a Participant may not replace', () => {
    // The same change an Editor makes reaches a checklist's items: refused for a Participant.
    const editor = replaceAllAs('edit', tab, 'plan', 'map');
    expect(participantTabChange(tab, editor.tab)).toBeNull();
  });

  it('lets a Viewer replace nothing', () => {
    const out = replaceAllAs('view', tab, 'plan', 'map');
    expect(out.count).toBe(0);
    expect(out.tab).toBe(tab);
  });

  it('holds locked text for every role', () => {
    const locked = fixtureTab({ locked: true });
    for (const level of ['edit', 'participate'] as const) {
      const out = replaceAllAs(level, locked, 'plan', 'map');
      expect(out.count).toBe(0);
      expect(out.tab).toBe(locked);
    }
  });
});
