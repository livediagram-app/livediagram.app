import { describe, expect, it } from 'vitest';
import { WIREFRAME_LAYOUTS } from './wireframe-layouts';
import { LOGO_LAYOUTS } from './logo-layouts';
import { WIREFRAME_FLOWS, isWireframeFlowKind } from './template-builders-wireframe-flows';
import { LOGO_EXPLORATIONS, isLogoExplorationKind } from './template-builders-logo-explorations';
import { buildTemplate } from './build-template';
import { templatePages } from './template-pages';
import { TEMPLATES } from './templates';

// docs/specs/007-editor/wireframe-pages.md "Templates" and logo-pages.md "Logo layouts": the flows and the logo
// explorations are data over the layout catalogues.
const layoutCategory = new Map(WIREFRAME_LAYOUTS.map((l) => [l.id, l.category]));
const logoLayouts = new Set(LOGO_LAYOUTS.map((l) => l.id));

describe('wireframe flows', () => {
  it('use only layouts made for their device: watch layouts on a watch, the rest elsewhere', () => {
    for (const [kind, flow] of Object.entries(WIREFRAME_FLOWS)) {
      for (const s of flow.screens) {
        expect(layoutCategory.has(s.layout), `${kind} ${s.layout}`).toBe(true);
        expect(layoutCategory.get(s.layout) === 'wf-watch', `${kind} ${s.layout}`).toBe(
          flow.device === 'watch',
        );
      }
      expect(new Set(flow.screens.map((s) => s.name)).size, kind).toBe(flow.screens.length);
    }
  });
});

describe('logo explorations', () => {
  it('cover every logo layout once, across the four families', () => {
    const all = Object.values(LOGO_EXPLORATIONS).flat();
    for (const id of all) expect(logoLayouts.has(id), id).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(LOGO_LAYOUTS.length);
  });
});

describe('templates on pages', () => {
  it('opens every flow and exploration on one named page per screen or layout, each page drawn on', () => {
    for (const t of TEMPLATES) {
      const count = isWireframeFlowKind(t.kind)
        ? WIREFRAME_FLOWS[t.kind].screens.length
        : isLogoExplorationKind(t.kind)
          ? LOGO_EXPLORATIONS[t.kind].length
          : null;
      if (count === null) continue;
      const pages = templatePages(t.kind)!;
      expect(pages, t.kind).toHaveLength(count);
      for (const p of pages) expect(p.name, t.kind).toBeTruthy();
      expect(buildTemplate(t.kind, 0, 0).length, t.kind).toBeGreaterThan(count);
    }
  });
});
