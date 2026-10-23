import { describe, expect, it } from 'vitest';
import { layOutPages, type Element } from '@livedocuments/document';
import { templateCanvasOverrides, type TemplateKind } from '@livedocuments/templates';
import { primsBounds } from '@livedocuments/icons';
import { ICON_CATALOG_1 } from '@livedocuments/icons/icon-catalog-1';
import { ICON_CATALOG_2 } from '@livedocuments/icons/icon-catalog-2';
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
// other direction. A template once slipped past the check that way.
const ALL_KINDS = [
  'blank',
  'blank-illustration',
  'blank-slide-deck',
  'blank-article',
  'blank-infographic',
  'slide-deck',
  'live-card',
  'storyboard',
  'floor-plan',
  'working-backwards',
  'article',
  'event-poster',
  'year-in-review',
  'resume',
  'recipe-card',
  'data-story',
  'how-it-works',
  'versus',
  'social-carousel',
  'launch-keynote',
  'quarterly-review',
  'team-welcome',
  'workshop-kickoff',
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
  'slide-deck',
  'live-card',
  'event-poster',
  'year-in-review',
  'resume',
  'recipe-card',
  'data-story',
  'how-it-works',
  'versus',
  'social-carousel',
  'launch-keynote',
  'quarterly-review',
  'team-welcome',
  'workshop-kickoff',
  'floor-plan',
  'storyboard',
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
  // A deck is built of slide pages; every other paged template of infographic pages. Either way a chosen kind, so the first page's kind choice is
  // never offered.
  // The decks: the Slide Deck and the decks built from slide layouts.
  const SLIDE_DECK_KINDS = new Set<string>([
    'slide-deck',
    'launch-keynote',
    'quarterly-review',
    'team-welcome',
    'workshop-kickoff',
  ]);
  it.each(PAGED_KINDS)('%s: opens on pages of its kind', (kind) => {
    const o = templateCanvasOverrides(kind);
    expect(o.pages?.length).toBeGreaterThan(0);
    const want = SLIDE_DECK_KINDS.has(kind) ? 'slide' : 'infographic';
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

  it('leaves the slide deck’s elements without notes', () => {
    const notes = buildTemplate('slide-deck', 0, 0).filter((el) => 'note' in el && el.note);
    expect(notes).toHaveLength(0);
  });

  it('keeps the group card a card the team signs: seven signed notes and an open slot', () => {
    const els = buildTemplate('live-card', 0, 0);
    expect(els.filter((el) => el.type === 'sticky')).toHaveLength(7);
    expect(els.some((el) => 'label' in el && el.label === '+ Your message here')).toBe(true);
  });
});

describe('buildTemplate', () => {
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
    const tab = buildTemplatedTab('slide-deck', 'slate', 'tab-xyz', 'My deck');
    expect(tab.id).toBe('tab-xyz');
    expect(tab.name).toBe('My deck');
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
    const tab = buildTemplatedTab('slide-deck', 'slate', 'tab-1', 'deck');
    const o = templateCanvasOverrides('slide-deck');
    expect(tab.pages).toEqual(o.pages);
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
  // are their zone washes); the unfilled square is the outer wall.
  const isWall = (el: Element) => el.type === 'shape' && el.fillColor === 'transparent';
  const rooms = elements
    .filter(
      (el) =>
        el.type === 'shape' &&
        el.shape === 'square' &&
        !isWall(el) &&
        (el as { opacity?: number }).opacity === undefined,
    )
    .map(boxOf);
  // Furniture is everything on the content layer (doors ride the
  // scaffold with the walls, because they straddle one).
  const furniture = elements.filter((el) => el.layerId === 'layer:template:content');

  it('draws seven rooms inside one outer wall', () => {
    expect(rooms).toHaveLength(7);
    const wall = boxOf(elements.find(isWall)!);
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
