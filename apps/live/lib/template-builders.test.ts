import { describe, expect, it } from 'vitest';
import {
  ES_LANES,
  laneIndexAt,
  laneCentre,
  runsPlainText,
  type Element,
} from '@livediagram/document';
import type { TemplateKind } from '@livediagram/templates';
import { primsBounds } from '@livediagram/icons';
import { ICON_CATALOG_1 } from '@livediagram/icons/icon-catalog-1';
import { ICON_CATALOG_2 } from '@livediagram/icons/icon-catalog-2';
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
  'mobile-wireframe',
  'laptop-wireframe',
  'slide-deck',
  'flywheel',
  'logo-design',
  'gantt',
  'live-card',
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
  'town-hall',
  'business-model-canvas',
  'empathy-map',
  'funnel',
  'okr-tree',
  'sitemap',
  'browser-wireframe',
  'storyboard',
  'cloud-architecture',
  'uml-class',
  'state-machine',
  'floor-plan',
  'event-storming',
  'start-stop-continue',
  'mad-sad-glad',
  'four-ls',
  'sailboat',
  'incident-postmortem',
  'opportunity-solution-tree',
  'crazy-eights',
  'stakeholder-map',
  'risk-matrix',
  'user-persona',
  'meeting-agenda',
  'objectives-planner',
  'whiteboard',
  'article',
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

describe('the whiteboard template', () => {
  it('starts empty: a whiteboard is a clean board to draw on', () => {
    expect(buildTemplate('whiteboard', 0, 0)).toEqual([]);
  });
});

describe('the event-storming template', () => {
  it('seeds one domain event reading Board Created, and no text element', () => {
    const els = buildTemplate('event-storming', 0, 0);
    expect(els).toHaveLength(1);
    expect(els[0]).toMatchObject({
      type: 'sticky',
      esKind: 'domain-event',
      label: 'Board Created',
    });
    expect(els.some((el) => el.type === 'text')).toBe(false);
  });

  it.each([0, 137, -421, 1000])('lays its row on a lane when built at y %i', (cy) => {
    const notes = buildTemplate('event-storming', 0, cy).filter((el) => el.type === 'sticky');
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      const centre = n.y + n.height / 2;
      expect(centre).toBe(laneCentre(laneIndexAt(cy, ES_LANES), ES_LANES));
    }
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
  it.each(ALL_KINDS.filter((k) => k !== 'blank' && k !== 'whiteboard' && k !== 'article'))(
    '%s: every coordinate shifts by (cx, cy)',
    (kind) => {
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
          // The event-storming row lands on a lane (docs/specs/021-event-storming/event-storming.md Phase 6), so it
          // moves on y by whole lane pitches rather than by exactly DY.
          if (kind !== 'event-storming') expect(cb[j]!.y - ca[j]!.y).toBeCloseTo(DY, 5);
        }
      }
    },
  );

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

describe('system architecture is a vendor-neutral tiered diagram', () => {
  // The logical sibling of Cloud architecture (docs/specs/008-canvas/canvas-and-palette.md): four tier lanes
  // holding labelled nodes, no vendor marks, every edge pinned and named.
  const els = buildTemplate('system-architecture', 0, 0);
  const shapes = els.filter((el): el is Extract<Element, { type: 'shape' }> => el.type === 'shape');

  it('stacks the Clients / Edge / Services / Data lanes', () => {
    expect(shapes.filter((el) => el.shape === 'lane').map((el) => el.label)).toEqual([
      'Clients',
      'Edge',
      'Services',
      'Data',
    ]);
  });

  it('names every node on the node and uses no technology marks', () => {
    const nodes = shapes.filter((el) => el.shape !== 'lane');
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.label?.length).toBeGreaterThan(0);
      if (n.iconId) expect(isTechIconId(n.iconId)).toBe(false);
    }
  });

  it('pins and labels every edge', () => {
    const arrows = els.filter(
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

describe('board templates seed per-range rich text', () => {
  // The label is the plain-text mirror of its runs (docs/specs/008-canvas/canvas-and-palette.md); every
  // richText-carrying element must keep `label === runsPlainText(richText)`
  // or legacy readers (search / export / auto-rename) drift from what
  // renders. Asserted across every board element that opts into runs.
  const labelMirrorsRuns = (kind: TemplateKind) => {
    const withRuns = buildTemplate(kind, 0, 0).filter(
      (el): el is Extract<Element, { richText?: unknown }> & { richText: NonNullable<unknown> } =>
        Array.isArray((el as { richText?: unknown }).richText),
    );
    expect(withRuns.length).toBeGreaterThan(0);
    for (const el of withRuns) {
      const runs = (el as { richText: Parameters<typeof runsPlainText>[0] }).richText;
      expect((el as { label?: string }).label).toBe(runsPlainText(runs));
    }
  };

  it('kanban ticket cards bold the id lead-in, leaving the summary plain', () => {
    labelMirrorsRuns('kanban');
    const cards = buildTemplate('kanban', 0, 0).filter((el) =>
      Array.isArray((el as { richText?: unknown }).richText),
    );
    // Realistic mid-sprint board: varied card counts per lane (4 + 3 + 3 + 1 + 4).
    expect(cards.length).toBe(15);
    for (const card of cards) {
      const runs = (card as { richText: { text: string; bold?: boolean }[] }).richText;
      // Bold ticket id lead-in (e.g. "CHK-241:") + a plain summary run.
      expect(runs[0]?.bold).toBe(true);
      expect(runs[0]?.text).toMatch(/^CHK-\d+:$/);
      expect(runs[1]?.bold).toBeUndefined();
    }
  });
});

describe('floor plan geometry', () => {
  // A floor plan is the one template whose numbers mean something in
  // the world: it is authored in metres at a fixed 80px scale, so the
  // proportions only hold if the furniture actually fits the rooms it
  // is drawn in. These checks are what stop a later "nudge the sofa"
  // edit from quietly parking a bathtub in the hallway.
  const elements = buildTemplate('floor-plan', 0, 0);
  const boxOf = (el: Element) => {
    const b = el as { x: number; y: number; width: number; height: number };
    return { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
  };
  // Rooms are the opaque square scaffold shapes (the translucent squares
  // are their zone washes); the frame is the outer wall.
  const rooms = elements
    .filter(
      (el) =>
        el.type === 'shape' &&
        el.shape === 'square' &&
        (el as { opacity?: number }).opacity === undefined,
    )
    .map(boxOf);
  // Furniture is everything on the content layer (doors ride the
  // scaffold with the walls, because they straddle one).
  const furniture = elements.filter((el) => el.layerId === 'layer:template:content');

  it('draws seven rooms inside one outer wall', () => {
    expect(rooms).toHaveLength(7);
    const wall = boxOf(elements.find((el) => el.type === 'shape' && el.shape === 'frame')!);
    for (const room of rooms) {
      expect(room.x1).toBeGreaterThanOrEqual(wall.x1);
      expect(room.y1).toBeGreaterThanOrEqual(wall.y1);
      expect(room.x2).toBeLessThanOrEqual(wall.x2);
      expect(room.y2).toBeLessThanOrEqual(wall.y2);
    }
  });

  it('keeps every piece of furniture inside a room', () => {
    expect(furniture.length).toBeGreaterThan(0);
    const strays: string[] = [];
    for (const piece of furniture) {
      const b = boxOf(piece);
      const inside = rooms.some(
        (r) =>
          b.x1 >= r.x1 - 0.01 && b.y1 >= r.y1 - 0.01 && b.x2 <= r.x2 + 0.01 && b.y2 <= r.y2 + 0.01,
      );
      if (!inside) strays.push(`${(piece as { iconId?: string }).iconId} at ${b.x1},${b.y1}`);
    }
    expect(strays).toEqual([]);
  });

  it('never stacks two pieces of furniture on the same floor space', () => {
    const clashes: string[] = [];
    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const a = boxOf(furniture[i]!);
        const b = boxOf(furniture[j]!);
        // Touching edges is fine (a table against a wall unit); real
        // overlap is not.
        const overlaps =
          a.x1 < b.x2 - 0.01 && b.x1 < a.x2 - 0.01 && a.y1 < b.y2 - 0.01 && b.y1 < a.y2 - 0.01;
        if (overlaps) {
          clashes.push(
            `${(furniture[i] as { iconId?: string }).iconId} / ${(furniture[j] as { iconId?: string }).iconId}`,
          );
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  // The drawn ink of an icon element (its glyph bounds scaled to the box, rotated in quarter
  // turns about the centre), not its square box: a door's arc or a sofa's back is what reads.
  const inkOf = (el: Element) => {
    const b = boxOf(el);
    const def = [...ICON_CATALOG_1, ...ICON_CATALOG_2].find(
      (d) => d.id === (el as { iconId?: string }).iconId,
    )!;
    const g = primsBounds(def.prims)!;
    const k = (b.x2 - b.x1) / 24;
    const turns = (((el as { rotation?: number }).rotation ?? 0) / 90) % 4;
    // Rotate the 0..24 bounds clockwise about 12,12, one quarter at a time.
    let [x1, y1, x2, y2] = [g.minX, g.minY, g.maxX, g.maxY];
    for (let t = 0; t < turns; t++) [x1, y1, x2, y2] = [24 - y2, x1, 24 - y1, x2];
    return { x1: b.x1 + x1 * k, y1: b.y1 + y1 * k, x2: b.x1 + x2 * k, y2: b.y1 + y2 * k };
  };
  const overlap = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) =>
    a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5;
  const icons = elements.filter((el) => el.type === 'shape' && el.shape === 'icon');
  const doors = icons.filter((el) => (el as { iconId?: string }).iconId === 'door');
  // Room captions: the text's own run, ~7px a character at the caption size, not its full-width box.
  const captions = elements
    .filter((el) => el.type === 'text' && / m²$/.test((el as { label?: string }).label ?? ''))
    .filter((el) => !(el as { label: string }).label.startsWith('Floor plan'))
    .map((el) => {
      const b = boxOf(el);
      return {
        label: (el as { label: string }).label,
        box: { ...b, x2: b.x1 + (el as { label: string }).label.length * 7 },
      };
    });

  it('keeps every room caption clear of furniture and door swings', () => {
    const hits = captions.flatMap((c) =>
      icons
        .filter((el) => overlap(inkOf(el), c.box))
        .map((el) => `${c.label} / ${(el as { iconId?: string }).iconId}`),
    );
    expect(hits).toEqual([]);
  });

  it('swings every door clear of the furniture', () => {
    const hits = doors.flatMap((d) =>
      furniture
        .filter((f) => overlap(inkOf(d), inkOf(f)))
        .map((f) => (f as { iconId?: string }).iconId),
    );
    expect(hits).toEqual([]);
  });

  it('seats the desk on its own drawn chair, not a second one', () => {
    const desk = inkOf(furniture.find((f) => (f as { iconId?: string }).iconId === 'desk')!);
    const room = rooms.find(
      (r) => desk.x1 >= r.x1 && desk.x2 <= r.x2 && desk.y1 >= r.y1 && desk.y2 <= r.y2,
    )!;
    const chairs = furniture.filter((f) => {
      const c = boxOf(f);
      return (
        (f as { iconId?: string }).iconId === 'chair' &&
        c.x1 >= room.x1 &&
        c.x2 <= room.x2 &&
        c.y1 >= room.y1 &&
        c.y2 <= room.y2
      );
    });
    expect(chairs).toEqual([]);
  });

  it('sizes furniture by real footprints, not by whatever fitted', () => {
    const size = (icon: string) => {
      const el = furniture.find((p) => (p as { iconId?: string }).iconId === icon);
      return (el as { width: number } | undefined)?.width;
    };
    // 80px = 1m, so a double bed is far bigger than a toilet and a
    // bathtub sits between them. Pinned as ratios of the scale rather
    // than raw pixels so the intent survives a scale change.
    expect(size('bed')! / 80).toBeCloseTo(1.85);
    expect(size('bathtub')! / 80).toBeCloseTo(1.7);
    expect(size('toilet')! / 80).toBeCloseTo(0.8);
    expect(size('bed')!).toBeGreaterThan(size('bathtub')!);
    expect(size('bathtub')!).toBeGreaterThan(size('toilet')!);
  });
});
