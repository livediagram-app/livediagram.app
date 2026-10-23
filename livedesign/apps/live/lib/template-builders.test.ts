import { describe, expect, it } from 'vitest';
import { layOutPages, type Element } from '@livedesign/design';
import { templateCanvasOverrides, type TemplateKind } from '@livedesign/templates';
import { buildTemplate, buildTemplatedTab } from './template-builders';

// `buildTemplate` is the dispatch that turns a TemplateKind into the
// starting elements when the user picks a template (docs/specs/008-canvas/canvas-and-palette.md's
// picker). Each builder is documented as pure, returning a fresh array of Element; the templates on
// pages are built in page coordinates, wherever the caller centres them.

// Every TemplateKind listed here. Adding a kind to templates.ts
// without adding it here would let a new builder ship without
// purity coverage. The two checks below catch the
// drift at compile time:
//   - `satisfies readonly TemplateKind[]` guarantees every entry IS
//     a TemplateKind (catches typos in this list).
//   - The `MissingFromAllKinds` type computes the set of
//     TemplateKinds NOT in ALL_KINDS; the type assertion below
//     fails to compile when that set is non-empty.
// The previous wording claimed `satisfies` alone enforced
// exhaustiveness, which was wrong: `satisfies` only checks the
// other direction. `logo-design` slipped past the check that way.
const ALL_KINDS = [
  'blank',
  'blank-illustration',
  'blank-logo',
  'blank-wireframe-phone',
  'blank-wireframe-tablet',
  'blank-wireframe-browser',
  'blank-wireframe-laptop',
  'blank-wireframe-watch',
  'photo-edit',
  'logo-design',
  'wireframe-mobile-app',
  'wireframe-website',
  'wireframe-dashboard',
  'wireframe-tablet-app',
  'wireframe-watch-app',
] as const satisfies readonly TemplateKind[];

// Real exhaustiveness check: any TemplateKind missing from
// ALL_KINDS surfaces as a non-`never` type and the assignment
// below stops compiling. The `void` discards the unused binding
// without tripping the lint rule.
type MissingFromAllKinds = Exclude<TemplateKind, (typeof ALL_KINDS)[number]>;
const _allKindsExhaustive: [MissingFromAllKinds] extends [never] ? true : never = true;
void _allKindsExhaustive;

// Every numeric coordinate carried by an element. For boxed
// elements (shape / text / sticky / image) that's (x, y). For
// arrows it's whichever endpoints are 'free' (pinned endpoints
// reference an element id rather than a coordinate, so they
// translate automatically when their target shape moves). Returned
// as an array so the assertions can iterate without knowing which
// shape an element is.
function coordsOf(el: Element): { x: number; y: number }[] {
  if (el.type === 'arrow') {
    const out: { x: number; y: number }[] = [];
    if (el.from.kind === 'free') out.push({ x: el.from.x, y: el.from.y });
    if (el.to.kind === 'free') out.push({ x: el.to.x, y: el.to.y });
    return out;
  }
  return [{ x: el.x, y: el.y }];
}

// The templates that open in Pages on pages of their own (canvas-and-palette.md "Templates
// on pages").
const PAGED_KINDS = [
  'logo-design',
  'wireframe-mobile-app',
  'wireframe-website',
  'wireframe-dashboard',
  'wireframe-tablet-app',
  'wireframe-watch-app',
] as const;

// An element's centre, from its box or, for an arrow, its free endpoints' midpoint.
function centreOf(el: Element): { x: number; y: number } | undefined {
  if (el.type === 'arrow') {
    const pts = coordsOf(el);
    if (pts.length === 0) return undefined;
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    };
  }
  const b = el as { x: number; y: number; width: number; height: number };
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

describe('templates on pages', () => {
  // The logo exploration is built of logo pages, a wireframe flow of wireframe pages: a chosen kind
  // either way, so the first page's kind choice is never offered.
  it.each(PAGED_KINDS)('%s: opens in Pages on pages of its kind', (kind) => {
    const o = templateCanvasOverrides(kind);
    expect(o.opensIn).toBe('pages');
    expect(o.pages?.length).toBeGreaterThan(0);
    const want = kind === 'logo-design' ? 'logo' : 'wireframe';
    expect(o.pages!.every((p) => p.kind === want)).toBe(true);
    expect(new Set(o.pages!.map((p) => p.id)).size).toBe(o.pages!.length);
  });

  it.each(PAGED_KINDS)(
    '%s: puts every element centre on one of its pages, and every page gets content',
    (kind) => {
      const rects = layOutPages(templateCanvasOverrides(kind).pages!).map((p) => p.rect);
      // Wherever the caller centres it: the elements are built in page coordinates.
      for (const [cx, cy] of [
        [0, 0],
        [137, -421],
      ] as const) {
        const els = buildTemplate(kind, cx, cy);
        expect(els.length).toBeGreaterThan(0);
        const used = new Set<number>();
        const strays: string[] = [];
        for (const el of els) {
          const c = centreOf(el);
          if (!c) continue;
          const page = rects.findIndex(
            (r) => c.x >= r.x && c.x <= r.x + r.width && c.y >= r.y && c.y <= r.y + r.height,
          );
          if (page < 0) strays.push(`${el.type} ${'label' in el ? el.label : ''} at ${c.x},${c.y}`);
          else used.add(page);
        }
        expect(strays).toEqual([]);
        expect(used.size).toBe(rects.length);
      }
    },
  );
});

describe('buildTemplate', () => {
  it.each(ALL_KINDS)('%s: returns a fresh array per call (no shared mutable state)', (kind) => {
    // Builders are documented as pure, returning "a fresh array of
    // Element". A future revision that memoised or returned a
    // module-level constant would silently let one design's edits
    // leak into another template instantiation. Asserting distinct
    // references rules that out.
    const a = buildTemplate(kind, 0, 0);
    const b = buildTemplate(kind, 0, 0);
    expect(a).not.toBe(b);
    expect(a.length).toBe(b.length);
    if (a.length > 0) expect(a[0]).not.toBe(b[0]);
  });
});

describe('buildTemplatedTab', () => {
  it('stamps the tab id, name, theme, and templateChosen flag', () => {
    const tab = buildTemplatedTab('logo-design', 'slate', 'tab-xyz', 'My logo');
    expect(tab.id).toBe('tab-xyz');
    expect(tab.name).toBe('My logo');
    expect(tab.theme).toBe('slate');
    // templateChosen tracks "the user has explicitly picked a
    // template for this tab" so the picker doesn't pop again on a
    // re-render. A regression that forgets to set it would loop
    // the picker over a freshly-built tab.
    expect(tab.templateChosen).toBe(true);
    expect(tab.elements.length).toBeGreaterThan(0);
  });

  it('carries the template’s canvas overrides: its mode and its pages', () => {
    // Catches the regression where the templateCanvasOverrides spread stops reaching the returned tab, or the
    // theme's defaults overwrite it.
    const tab = buildTemplatedTab('logo-design', 'slate', 'tab-1', 'logo');
    const o = templateCanvasOverrides('logo-design');
    expect(tab.opensIn).toBe('pages');
    expect(tab.pages).toEqual(o.pages);
  });
});
