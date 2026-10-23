import { THEMES as DESIGN_THEMES } from '@livedesign/design';
import { LOGO_LAYOUTS, TEMPLATES as DESIGN_TEMPLATES } from '@livedesign/templates';
import { THEMES as DIAGRAM_THEMES } from '@livediagram/document';
import { TEMPLATES as DIAGRAM_TEMPLATES } from '@livediagram/templates';
import { THEMES as DOCUMENTS_THEMES } from '@livedocuments/document';
import { SLIDE_LAYOUTS, TEMPLATES as DOCUMENTS_TEMPLATES } from '@livedocuments/templates';
import { isBlankTemplate, isPlanTemplate, TEMPLATES as PLANNER_TEMPLATES } from '@liveplanner/templates';
import type { SiteId } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { COMPETITOR_LOOK } from './competitor-look';
import { ALTERNATIVES } from './index';

// The comparisons write each app's catalogue sizes out ("23 templates", "61 layouts"); every
// mention must match that app's catalogue, so a template added in an app fails here until its
// comparisons follow it.

const copyOf = (app: SiteId) =>
  JSON.stringify(
    ALTERNATIVES.filter((a) => a.apps.includes(app)).map((a) => [
      a,
      COMPETITOR_LOOK[a.slug]?.highlights,
    ]),
  );

const counted = (copy: string, pattern: RegExp, words: Record<string, number> = {}) =>
  [...copy.matchAll(pattern)].map((m) =>
    /^\d+$/.test(m[1]!) ? Number(m[1]) : words[m[1]!.toLowerCase()],
  );

const TEMPLATE_COUNT = /(\d+) (?:ready-made |starter )?templates/g;
const THEME_COUNT = /\b(\d+|twenty-[a-z]+) (?:one-click )?(?:whole-canvas )?themes\b/gi;
const THEME_WORDS = { 'twenty-four': 24 };
// The seasonal themes are the seasonal looks' own, never offered in a picker, so the copy counts
// the rest.
const offered = (themes: readonly { seasonal?: boolean }[]) => themes.filter((t) => !t.seasonal).length;

describe('livediagram counts', () => {
  const copy = copyOf('livediagram.app');
  it('match its templates', () => {
    for (const n of counted(copy, TEMPLATE_COUNT)) expect(n).toBe(DIAGRAM_TEMPLATES.length);
  });
  it('match its themes', () => {
    for (const n of counted(copy, THEME_COUNT, THEME_WORDS)) expect(n).toBe(offered(DIAGRAM_THEMES));
  });
});

describe('liveplanner counts', () => {
  const copy = copyOf('liveplanner.app');
  const plans = PLANNER_TEMPLATES.filter(
    (t) => !t.hidden && isPlanTemplate(t.kind) && !isBlankTemplate(t.kind),
  );
  it('match its Plan templates', () => {
    for (const n of counted(copy, TEMPLATE_COUNT)) expect(n).toBe(plans.length);
  });
});

describe('livedocuments counts', () => {
  const copy = copyOf('livedocuments.app');
  it('match its templates', () => {
    for (const n of counted(copy, TEMPLATE_COUNT)) expect(n).toBe(DOCUMENTS_TEMPLATES.length);
  });
  it('match its themes', () => {
    for (const n of counted(copy, THEME_COUNT, THEME_WORDS)) {
      expect(n).toBe(offered(DOCUMENTS_THEMES));
    }
  });
  it('match its slide layouts', () => {
    const counts = counted(copy, /\b(\d+|[a-z]+teen) (?:ready-made )?layouts\b/gi, { seventeen: 17 });
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(SLIDE_LAYOUTS.length);
  });
});

describe('livedesign counts', () => {
  const copy = copyOf('livedesign.app');
  it('match its templates', () => {
    for (const n of counted(copy, TEMPLATE_COUNT)) expect(n).toBe(DESIGN_TEMPLATES.length);
  });
  it('match its themes', () => {
    for (const n of counted(copy, THEME_COUNT, THEME_WORDS)) expect(n).toBe(offered(DESIGN_THEMES));
  });
  it('match its logo layouts', () => {
    for (const n of counted(copy, /(\d+) logo layouts/g)) expect(n).toBe(LOGO_LAYOUTS.length);
  });
});
