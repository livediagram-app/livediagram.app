import { describe, expect, it } from 'vitest';
import { settleChips, type Element } from '@livediagram/document';
import { buildTemplate } from './build-template';
import { buildPageLayout } from './page-layout-build';
import { layoutCatalogueFor } from './layout-catalogue';
import { TEMPLATES } from './templates';

// docs/specs/009-elements/blueprints/badge.md "Settling": a template or layout lands settled, its step numbers half
// their disc and its badges fitted, exactly as a stored board reads back, so a preview or an agent's create shows what
// the editor will.
const settled = (els: Element[]) => settleChips([], els, { attachLoose: false });

describe('template and layout output', () => {
  it('is settled for every template', () => {
    const unsettled = TEMPLATES.map((t) => t.kind).filter((kind) => {
      const els = buildTemplate(kind, 0, 0);
      return settled(els) !== els;
    });
    expect(unsettled).toEqual([]);
  });

  it('is settled for every page, slide and logo layout', () => {
    const page = {
      rect: { x: 0, y: 0, width: 1200, height: 900 },
      orientation: 'landscape',
      size: 'a4',
    };
    const unsettled = (['infographic', 'slide', 'logo'] as const).flatMap((kind) =>
      layoutCatalogueFor(kind)
        .layouts.filter((l) => {
          const els = buildPageLayout(l.id, page as Parameters<typeof buildPageLayout>[1]);
          return settled(els) !== els;
        })
        .map((l) => l.id),
    );
    expect(unsettled).toEqual([]);
  });
});
