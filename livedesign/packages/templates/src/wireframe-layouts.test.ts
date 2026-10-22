import { describe, expect, it } from 'vitest';
import {
  WIREFRAME_DEVICE_IDS,
  isBoxed,
  layOutPages,
  newWireframePage,
  pageContentBox,
  pageScreenRect,
} from '@livedesign/document';
import { buildPageLayout } from './page-layout-build';
import { WIREFRAME_LAYOUTS, wireframeLayoutsFor } from './wireframe-layouts';
import {
  buildWireframeFlow,
  WIREFRAME_FLOWS,
  wireframeFlowPages,
} from './template-builders-wireframe-flows';
import { layoutCatalogueFor } from './layout-catalogue';

describe('wireframe layouts', () => {
  it('offers a watch its own and every other device the rest', () => {
    expect(wireframeLayoutsFor('watch').layouts.every((l) => l.id.startsWith('wf-watch'))).toBe(
      true,
    );
    expect(wireframeLayoutsFor('phone').layouts.some((l) => l.id.startsWith('wf-watch'))).toBe(
      false,
    );
    expect(layoutCatalogueFor('wireframe').layouts).toHaveLength(WIREFRAME_LAYOUTS.length);
  });

  it.each(WIREFRAME_DEVICE_IDS)('%s: every layout it is offered lands on its screen', (device) => {
    for (const landscape of [false, true]) {
      const [page] = layOutPages([
        { ...newWireframePage('p', device), orientation: landscape ? 'landscape' : 'portrait' },
      ]);
      const screen = pageScreenRect(page!);
      const box = pageContentBox(page!);
      const cls = device === 'watch' ? 'watch' : 'phone';
      for (const layout of wireframeLayoutsFor(cls).layouts) {
        const els = buildPageLayout(layout.id, page!);
        expect(els.length).toBeGreaterThan(0);
        for (const el of els) {
          if (!isBoxed(el)) continue;
          // Every part's centre is on the screen (a divider may run to its edges).
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          expect(
            cx >= screen.x - 1 && cx <= screen.x + screen.width + 1,
            `${device} ${layout.id} x`,
          ).toBe(true);
          expect(
            cy >= screen.y - 1 && cy <= screen.y + screen.height + 1,
            `${device} ${layout.id} y`,
          ).toBe(true);
        }
        void box;
      }
    }
  });

  it('builds each flow on its own pages, one screen each', () => {
    for (const kind of Object.keys(WIREFRAME_FLOWS) as (keyof typeof WIREFRAME_FLOWS)[]) {
      const pages = layOutPages(wireframeFlowPages(kind));
      expect(pages.every((p) => p.kind === 'wireframe' && p.name)).toBe(true);
      const els = buildWireframeFlow(kind);
      for (const p of pages) {
        const on = els.filter(
          (el) => isBoxed(el) && el.x >= p.rect.x && el.x <= p.rect.x + p.rect.width,
        );
        expect(on.length, `${kind} ${p.name}`).toBeGreaterThan(0);
      }
    }
  });
});
