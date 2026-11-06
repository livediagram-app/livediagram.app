// The guard on docs/specs/008-canvas/canvas-and-palette.md "Templates on pages": every page
// background a template ships is the theme's own, so a theme change moves it.
import { describe, expect, it } from 'vitest';
import { followedFill, getBuiltInTheme, isThemeOwnFill, pagesOf } from '@livedocuments/document';
import { TEMPLATE_THEME } from './template-backgrounds';
import { templatePages } from './template-pages';
import { buildTemplateTab } from './template-tab';
import { TEMPLATES } from './templates';

const withPages = TEMPLATES.filter((t) => (templatePages(t.kind) ?? []).length > 0);

describe('template backgrounds', () => {
  it('ships no page background of its own: every fill is the theme’s', () => {
    const own: string[] = [];
    let fills = 0;
    for (const t of withPages) {
      for (const p of templatePages(t.kind) ?? []) {
        const fill = p.background?.fill;
        if (!fill) continue;
        fills++;
        if (!isThemeOwnFill(fill, TEMPLATE_THEME)) own.push(`${t.kind} / ${p.name}`);
      }
    }
    expect(own).toEqual([]);
    // The guard reads real backgrounds (the animated decks and the gradients), not none.
    expect(fills).toBeGreaterThan(20);
  });

  it('lands on the theme it is applied in, animated slides included', () => {
    const ocean = getBuiltInTheme('ocean');
    for (const kind of ['launch-keynote', 'slide-deck', 'year-in-review'] as const) {
      const want = (templatePages(kind) ?? []).map((p) =>
        p.background?.fill ? followedFill(p.background.fill, TEMPLATE_THEME, ocean) : undefined,
      );
      const tab = buildTemplateTab('t', 'T', kind, 'ocean');
      expect(pagesOf(tab).map((p) => p.background?.fill)).toEqual(want);
      expect(want.some((f) => f && f.kind === 'gradient' && f.from !== undefined)).toBe(true);
    }
  });
});
