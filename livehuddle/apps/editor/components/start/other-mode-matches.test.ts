import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livehuddle/document';
import {
  TEMPLATES,
  isBlankTemplate,
  popularKindsFor,
  templateEditorMode,
} from '@livehuddle/templates';
import { otherModeMatches } from './other-mode-matches';

// docs/specs/007-editor/start-diagramming.md "Found in other modes".
describe('otherModeMatches', () => {
  it('finds the Sailboat retrospective in Workshop from Start Diagramming', () => {
    const found = otherModeMatches('diagram', 'sailboat');
    expect(found.map((m) => m.mode)).toEqual(['workshop']);
    expect(found[0]!.kinds).toContain('sailboat');
  });

  it("never offers the tab's own mode", () => {
    for (const mode of EDITOR_MODES) {
      for (const query of ['board', 'blank', 'map', 'retro'])
        expect(otherModeMatches(mode, query).some((m) => m.mode === mode)).toBe(false);
    }
  });

  it('lists each template once, under the mode it opens in', () => {
    const found = otherModeMatches('diagram', 'a');
    const kinds = found.flatMap((m) => m.kinds);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const m of found) for (const k of m.kinds) expect(templateEditorMode(k)).toBe(m.mode);
  });

  it("keeps the modes' order and drops a mode with nothing found", () => {
    const order = otherModeMatches('diagram', 'blank').map((m) => m.mode);
    expect(order).toEqual(EDITOR_MODES.filter((m) => order.includes(m)));
    expect(otherModeMatches('diagram', 'zzzz-nothing')).toEqual([]);
  });

  it("finds another mode's blank", () => {
    expect(otherModeMatches('diagram', 'whiteboard')[0]).toEqual(
      expect.objectContaining({ mode: 'draw', kinds: expect.arrayContaining(['whiteboard']) }),
    );
  });

  it('leads with the Popular picks and leaves the blanks last', () => {
    const workshop = otherModeMatches('diagram', 'e').find((m) => m.mode === 'workshop')!;
    const popular = popularKindsFor('workshop').filter((k) => !isBlankTemplate(k));
    expect(popular).toContain(workshop.kinds[0]);
    const firstBlank = workshop.kinds.findIndex(isBlankTemplate);
    expect(workshop.kinds.slice(firstBlank).every(isBlankTemplate)).toBe(true);
    expect(otherModeMatches('diagram', 'blank').flatMap((m) => m.kinds)).toContain('blank-session');
  });

  it('finds nothing for an empty search', () => {
    expect(otherModeMatches('diagram', '   ')).toEqual([]);
  });

  it('leaves out a mode the tab may not enter', () => {
    const found = otherModeMatches('diagram', 'board', (m) => m !== 'workshop');
    expect(found.some((m) => m.mode === 'workshop')).toBe(false);
  });

  it('never offers a hidden template', () => {
    const hidden = TEMPLATES.filter((t) => t.hidden).map((t) => t.kind);
    for (const mode of EDITOR_MODES) {
      const kinds = otherModeMatches(mode, 'e').flatMap((m) => m.kinds);
      for (const k of hidden) expect(kinds).not.toContain(k);
    }
  });

  // Run on every keystroke of a start's search: the widest query (one letter matching nearly everything) across every
  // template of four modes stays far inside a frame.
  it('answers the widest query well inside a frame', () => {
    otherModeMatches('diagram', 'e'); // warm the cached haystacks, as the first keystroke does
    const start = performance.now();
    for (let i = 0; i < 50; i++) otherModeMatches('diagram', `e${'a'.repeat(i % 3)}`);
    expect((performance.now() - start) / 50).toBeLessThan(4);
  });
});
