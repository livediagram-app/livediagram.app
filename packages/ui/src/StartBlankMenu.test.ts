import { CTA_SOURCES, CTA_VIA_PARAM, type CtaSurface } from '@livediagram/api-schema';
import { describe, expect, it } from 'vitest';

import { blankHref } from './StartBlankMenu';

const BLANK_SLOTS = ['HeaderDraw', 'HeaderWhiteboard', 'HeaderIllustration', 'HeaderPlan'] as const;

describe('blankHref', () => {
  it('tags a blank with its surface’s funnel source', () => {
    expect(blankHref('/new?blank=1', 'HeaderDraw', 'Help')).toBe(
      `/new?blank=1&${CTA_VIA_PARAM}=Help.HeaderDraw`,
    );
  });

  it('sends a plain link when no surface is named', () => {
    expect(blankHref('/new?template=blank-plan', 'HeaderPlan')).toBe('/new?template=blank-plan');
  });

  // Every surface whose header shows the Start Blank menu (it has a Header slot) lists all five blanks, so
  // no row ever falls back to an untagged link (docs/specs/019-marketing/landing-funnel.md).
  it('finds every blank in the table for every surface with a header', () => {
    for (const surface of Object.keys(CTA_SOURCES) as CtaSurface[]) {
      const slots: readonly string[] = CTA_SOURCES[surface];
      if (!slots.includes('Header')) continue;
      for (const slot of BLANK_SLOTS) expect(slots, `${surface}.${slot}`).toContain(slot);
    }
  });
});
