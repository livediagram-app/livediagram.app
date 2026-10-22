import { describe, expect, it } from 'vitest';
import { layOutPages, type Element } from '@livedesign/document';
import { templateCanvasOverrides, type TemplateKind } from '@livedesign/templates';
import { buildTemplate, buildTemplatedTab } from './template-builders';
import { isTechIconId } from './tech-icons';

// `buildTemplate` is the dispatch that turns a TemplateKind into the
// starting elements when the user picks a template (docs/specs/008-canvas/canvas-and-palette.md's
// picker). Each builder is documented as "pure: takes a centre
// (cx, cy) and returns a fresh array of Element". A regression in
// any one builder where elements hardcode (0, 0) instead of using
// (cx, cy) would drop the template off-centre on the canvas (the
// picker passes the viewport centre as cx/cy on every selection).
// One translation-invariance test covers all 16 builders at once.

// Every TemplateKind listed here. Adding a kind to templates.ts
// without adding it here would let a new builder ship without
// translation-invariance coverage. The two checks below catch the
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
  'mindmap',
  'mindmap-tree',
  'mindmap-bubble',
  'orgchart',
  'retrospective',
  'flowchart',
  'swimlane',
  'decision-tree',
  'approval-workflow',
  'data-flow',
  'kanban',
  'swot',
  'timeline',
  'milestone-timeline',
  'milestone-timeline-vertical',
  'venn',
  'journey',
  'fishbone',
  'pyramid',
  'flywheel',
  'logo-design',
  'wireframe-mobile-app',
  'wireframe-website',
  'wireframe-dashboard',
  'wireframe-tablet-app',
  'wireframe-watch-app',
  'gantt',
  'comparison-table',
  'system-architecture',
  'er-diagram',
  'sequence-diagram',
  'prioritization-matrix',
  'roadmap',
  'raci-matrix',
  'user-story-map',
  'affinity-map',
  'lean-coffee',
  'pub-quiz',
  'icebreaker-questions',
  'virtual-office',
  'coworking-space',
  'team-pod',
  'all-hands-hall',
  'two-truths-and-a-lie',
  'would-you-rather',
  'people-bingo',
  'brainstorm',
  'workshop-board',
  'town-hall',
  'business-model-canvas',
  'empathy-map',
  'funnel',
  'sankey',
  'okr-tree',
  'sitemap',
  'cloud-architecture',
  'uml-class',
  'state-machine',
  'start-stop-continue',
  'mad-sad-glad',
  'four-ls',
  'sailboat',
  'incident-postmortem',
  'opportunity-solution-tree',
  'crazy-eights',
  'stakeholder-map',
  'risk-matrix',
  'wardley-map',
  'threat-model',
  'service-blueprint',
  'metric-tree',
  'value-proposition-canvas',
  'family-tree',
  'value-stream-map',
  'user-persona',
  'meeting-agenda',
  'objectives-planner',
  'whiteboard',
  'blank-illustration',
  'blank-logo',
  'blank-wireframe-phone',
  'blank-wireframe-tablet',
  'blank-wireframe-browser',
  'blank-wireframe-laptop',
  'blank-wireframe-watch',
  'sketchnote',
  'rich-picture',
  'comic-strip',
  'doodle-warmup',
  'paper-prototype',
  'journey-doodle',
  'pre-mortem',
  'idea-garden',
  'blank-plan',
  'blank-spreadsheet',
  'blank-session',
  'project-planner',
  'bug-triage',
  'team-retro',
  'weekly-planner',
  'content-calendar',
  'hiring-pipeline',
  'okrs',
  'product-launch',
  'feedback-board',
  'budget-planner',
  'timesheet',
  'contact-list',
  'task-tracker',
  'invoice',
  'expense-report',
  'loan-calculator',
  'sales-pipeline',
  'inventory',
  'guest-list',
  'grade-book',
  'habit-tracker',
  'blank-form',
  'bug-report-form',
  'feedback-form',
  'feature-request-form',
  'rsvp-form',
  'job-application-form',
  'contact-form',
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

describe('the whiteboard template', () => {
  it('starts empty: a whiteboard is a clean board to draw on', () => {
    expect(buildTemplate('whiteboard', 0, 0)).toEqual([]);
  });
});

describe('buildTemplate translation invariance', () => {
  // For each kind, building at (Δx, Δy) must produce the same
  // element shapes as building at (0, 0) and shifting every
  // coordinate by (Δx, Δy). Asymmetric values intentionally so a
  // builder that swaps x/y or zeroes one axis fails loudly.
  const DX = 137;
  const DY = -421;

  // 'blank' is intentionally empty (no seeded element, docs/specs/007-editor/new-document-route.md), so it has no
  // coordinates to shift — excluded from this invariance check (it stays in
  // ALL_KINDS above for the exhaustiveness assertion).
  // The templates on pages are built on their pages, not around (cx, cy); 'templates on pages'
  // below pins where they land instead.
  it.each(
    ALL_KINDS.filter(
      (k) =>
        k !== 'blank' &&
        k !== 'whiteboard' &&
        k !== 'blank-illustration' &&
        // One empty page of a chosen kind (docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind").
        k !== 'blank-logo' &&
        !k.startsWith('blank-wireframe-') &&
        // An empty Plan tab: it opens on Start Planning (docs/specs/026-plan/plan-templates.md).
        k !== 'blank-plan' &&
        // An empty session tab (docs/specs/012-collaboration/workshop-mode.md "Templates").
        k !== 'blank-session' &&
        // A form template's empty Plan tab: the editor starts the form on it (docs/specs/030-forms/forms.md).
        !k.endsWith('-form') &&
        !(PAGED_KINDS as readonly string[]).includes(k),
    ),
  )('%s: every coordinate shifts by (cx, cy)', (kind) => {
    const atOrigin = buildTemplate(kind, 0, 0);
    const atOffset = buildTemplate(kind, DX, DY);

    expect(atOffset.length).toBe(atOrigin.length);
    expect(atOrigin.length).toBeGreaterThan(0);

    for (let i = 0; i < atOrigin.length; i++) {
      const a = atOrigin[i]!;
      const b = atOffset[i]!;
      // Element types stay aligned (a 'shape' at position N stays
      // a 'shape' at position N regardless of the centre): the
      // builder is a pure function of (kind, cx, cy).
      expect(b.type).toBe(a.type);

      const ca = coordsOf(a);
      const cb = coordsOf(b);
      expect(cb.length).toBe(ca.length);
      for (let j = 0; j < ca.length; j++) {
        // toBeCloseTo (not toBe) because trig-based builders
        // (mindmap branches, flywheel sectors) introduce IEEE 754
        // rounding when the same trig terms get added in different
        // orders. The contract is "shift by (cx, cy)", not "shift
        // by exactly (cx, cy) bit-for-bit". Five-decimal precision
        // is well below sub-pixel and well above floating drift.
        expect(cb[j]!.x - ca[j]!.x).toBeCloseTo(DX, 5);
        expect(cb[j]!.y - ca[j]!.y).toBeCloseTo(DY, 5);
      }
    }
  });

  it.each(ALL_KINDS)('%s: returns a fresh array per call (no shared mutable state)', (kind) => {
    // Builders are documented as pure, returning "a fresh array of
    // Element". A future revision that memoised or returned a
    // module-level constant would silently let one document's edits
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
    const tab = buildTemplatedTab('flowchart', 'slate', 'tab-xyz', 'My flow');
    expect(tab.id).toBe('tab-xyz');
    expect(tab.name).toBe('My flow');
    expect(tab.theme).toBe('slate');
    // templateChosen tracks "the user has explicitly picked a
    // template for this tab" so the picker doesn't pop again on a
    // re-render. A regression that forgets to set it would loop
    // the picker over a freshly-built tab.
    expect(tab.templateChosen).toBe(true);
    expect(tab.elements.length).toBeGreaterThan(0);
  });

  it('mindmap template carries its canvas override (backgroundOpacity 0.8)', () => {
    // Only mindmap currently customises the canvas via
    // `templateCanvasOverrides`. Pinning the value here catches
    // the regression where the override stops getting spread onto
    // the returned tab (the templateCanvasOverrides call moves
    // out of the function or the spread gets reordered such that
    // the theme's default overwrites it).
    const tab = buildTemplatedTab('mindmap', 'slate', 'tab-1', 'mindmap');
    expect(tab.backgroundOpacity).toBe(0.8);
  });

  it('non-mindmap templates do not inherit mindmap-specific overrides', () => {
    // A dot-grid board carries no opacity at all; a graph-paper one only the
    // quiet-pattern step back (0.4), never the mind map's 0.8.
    expect(
      buildTemplatedTab('retrospective', 'slate', 'tab-1', 'retro').backgroundOpacity,
    ).toBeUndefined();
    expect(buildTemplatedTab('flowchart', 'slate', 'tab-1', 'flow').backgroundOpacity).toBe(0.4);
  });
});

describe('gantt workstream bars survive theming', () => {
  // The six progress bars carry their workstream's tint as the track fill.
  // They opt out of theme recolouring via `themeLockFill` so a non-brand
  // theme (which maps every shape to one element-fill) can't merge the three
  // workstreams into one colour. The sheet, header and group bands must NOT
  // carry the flag: they are background chrome and adopt the theme fill.
  const bars = (els: Element[]) =>
    els.filter(
      (el): el is Extract<Element, { type: 'shape' }> =>
        el.type === 'shape' && el.shape === 'progress-bar',
    );

  it('locks every bar track and leaves the chrome unlocked', () => {
    const els = buildTemplate('gantt', 0, 0);
    expect(bars(els)).toHaveLength(6);
    expect(bars(els).every((b) => b.themeLockFill)).toBe(true);
    // One track tint per workstream.
    expect(new Set(bars(els).map((b) => b.fillColor)).size).toBe(3);
    const squares = els.filter(
      (el): el is Extract<Element, { type: 'shape' }> =>
        el.type === 'shape' && el.shape === 'square' && el.width > 1000,
    );
    // The sheet, the calendar header and the three group bands.
    expect(squares).toHaveLength(5);
    expect(squares.some((s) => s.themeLockFill)).toBe(false);
  });

  it('themed gantt build keeps the three workstream tints distinct', () => {
    // End-to-end through buildTemplatedTab (the /live/new path), which
    // recolours to the chosen theme. Without the lock, all bars would
    // collapse to the Slate element-fill and the Set would be size 1.
    const tab = buildTemplatedTab('gantt', 'slate', 'tab-g', 'Gantt');
    expect(new Set(bars(tab.elements).map((b) => b.fillColor)).size).toBe(3);
  });
});

describe('the lane-based process templates give each role its own hue', () => {
  // Swimlane flowchart and approval workflow (docs/specs/008-canvas/canvas-and-palette.md):
  // one lane per role, each tinted its own colour, under a title and over a key.
  const lanesOf = (kind: TemplateKind) =>
    buildTemplate(kind, 0, 0).filter(
      (el): el is Extract<Element, { type: 'shape' }> => el.type === 'shape' && el.shape === 'lane',
    );

  it.each([
    ['swimlane', ['Customer', 'Sales', 'Warehouse', 'Courier']],
    ['approval-workflow', ['Requester', 'Manager', 'Finance']],
  ] as const)('%s: one lane per role, each in its own hue', (kind, roles) => {
    const lanes = lanesOf(kind);
    expect(lanes.map((l) => l.label)).toEqual(roles);
    expect(new Set(lanes.map((l) => l.fillColor)).size).toBe(roles.length);
    expect(new Set(lanes.map((l) => l.headerFill)).size).toBe(roles.length);
  });

  it.each(['swimlane', 'approval-workflow'] as const)(
    '%s: opens with a title and a key',
    (kind) => {
      const texts = buildTemplate(kind, 0, 0).filter(
        (el): el is Extract<Element, { type: 'text' }> => el.type === 'text',
      );
      expect(texts.some((t) => t.textSize === 'lg' && t.textBold)).toBe(true);
      expect(texts.map((t) => t.label)).toContain('Key');
    },
  );
});

describe('system architecture is a vendor-neutral tiered diagram', () => {
  // The logical sibling of Cloud architecture (docs/specs/008-canvas/canvas-and-palette.md): four tier lanes
  // holding labelled nodes, no vendor marks, every edge pinned and named. The
  // components ride the content layer; the scaffold (lanes, gutter glyphs,
  // the key's sample lines) is checked apart.
  const els = buildTemplate('system-architecture', 0, 0);
  const shapes = els.filter((el): el is Extract<Element, { type: 'shape' }> => el.type === 'shape');
  const components = els.filter((el) => el.layerId === 'layer:template:content');

  it('stacks the Clients / Edge / Services / Data lanes', () => {
    expect(shapes.filter((el) => el.shape === 'lane').map((el) => el.label)).toEqual([
      'Clients',
      'Edge',
      'Services',
      'Data',
    ]);
  });

  it('names every node on the node and uses no technology marks', () => {
    const nodes = components.filter(
      (el): el is Extract<Element, { type: 'shape' }> => el.type === 'shape',
    );
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      // A service node is a Card named by its title; a store keeps its label.
      expect((n.shape === 'card' ? n.pageTitle : n.label)?.length).toBeGreaterThan(0);
      if (n.iconId) expect(isTechIconId(n.iconId)).toBe(false);
    }
    expect(nodes.filter((n) => n.shape === 'card').every((n) => n.accentEdge === 'left')).toBe(
      true,
    );
  });

  it('pins and labels every edge', () => {
    const arrows = components.filter(
      (el): el is Extract<Element, { type: 'arrow' }> => el.type === 'arrow',
    );
    expect(arrows.length).toBeGreaterThan(0);
    for (const a of arrows) {
      expect(a.from.kind).toBe('pinned');
      expect(a.to.kind).toBe('pinned');
      expect(a.label?.length).toBeGreaterThan(0);
    }
  });
});
