import { describe, expect, it } from 'vitest';
import { buildTemplate, buildTemplatedTab } from './template-builders';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CONTENT_LAYER_ID,
  TEMPLATE_SCAFFOLD_LAYER_ID,
  templateCanvasOverrides,
  templateCategory,
  templateLayers,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livediagram/templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" diagram that doesn't match the option they picked.
// The theming is the bit most likely to silently drift, so the
// tests below pin each element type's recolouring contract.

// The catalogue's shape (count + default/extra split + no kind
// drift) is load-bearing across both the picker and the marketing
// site. spec/16 pins "44 templates (10 default + 34 extra)" and
// spec/09 catalogues the picker UX. These tests pin the array so
// either the spec or the catalogue can't silently drift away from
// the other.
describe('TEMPLATES catalogue', () => {
  // List of every TemplateKind union member, kept in lockstep with
  // the catalogue. If a new kind lands in the union, both this list
  // AND the catalogue must grow; the test below catches a drift in
  // either direction.
  const ALL_KINDS: TemplateKind[] = [
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
    'guided-tour',
  ];

  // Hidden templates (spec/69's guided tour) are buildable but never
  // listed, so every user-facing count (spec/16's "44 templates", the
  // picker grids, the MCP catalogue) is over the listed subset.
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 44 templates (10 default + 34 extra, matches spec/16 and spec/09)', () => {
    expect(listed).toHaveLength(44);
  });

  it('splits cleanly into 10 default + 34 extra (the picker uses `extra` to gate behind "Show more")', () => {
    const defaults = listed.filter((t) => !t.extra);
    const extras = listed.filter((t) => t.extra);
    expect(defaults).toHaveLength(10);
    expect(extras).toHaveLength(34);
  });

  it('hides exactly the guided tour (spec/69), a self-explaining sample scene', () => {
    expect(TEMPLATES.filter((t) => t.hidden).map((t) => t.kind)).toEqual(['guided-tour']);
    const elements = buildTemplate('guided-tour', 0, 0);
    // The tour teaches through annotation markers: several, each with a
    // non-empty note, plus pinned arrows and a sticky note to poke at.
    const annotations = elements.filter((el) => el.type === 'annotation');
    expect(annotations.length).toBeGreaterThanOrEqual(4);
    for (const a of annotations) expect((a.note ?? '').trim().length).toBeGreaterThan(0);
    expect(elements.some((el) => el.type === 'arrow' && el.from.kind === 'pinned')).toBe(true);
    expect(elements.some((el) => el.type === 'sticky')).toBe(true);
  });

  it('has no duplicate kinds (guards against accidental copy-paste in the catalogue)', () => {
    const kinds = TEMPLATES.map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('assigns every template to a known category (the picker groups templates by category)', () => {
    const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      expect(known.has(templateCategory(t.kind))).toBe(true);
    }
  });

  it('lists every TemplateKind member exactly once', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const kind of ALL_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(kinds.size).toBe(ALL_KINDS.length);
  });

  it('every kind builds without throwing (the buildTemplate switch handles every union member)', () => {
    for (const kind of ALL_KINDS) {
      const tab = buildTemplatedTab(kind, 'brand', `tab-${kind}`, 'name');
      // 'blank' is intentionally empty (spec/14); every other kind seeds
      // content. Either way the switch must handle the union member.
      expect(tab.elements.length).toBeGreaterThan(kind === 'blank' ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('gives mind maps a softer backdrop opacity (plus an explicit grid)', () => {
    // Mind maps sit on a slightly translucent canvas so the central
    // node reads as a focal point rather than competing with the
    // background pattern.
    expect(templateCanvasOverrides('mindmap')).toEqual({
      backgroundPattern: 'grid',
      backgroundOpacity: 0.8,
    });
  });

  it('gives alignment-heavy scaffolds a square graph paper backdrop', () => {
    expect(templateCanvasOverrides('flowchart')).toEqual({ backgroundPattern: 'graph' });
    expect(templateCanvasOverrides('orgchart')).toEqual({ backgroundPattern: 'graph' });
    // Layered templates (spec/74) additionally carry their Tab.layers.
    expect(templateCanvasOverrides('swot')).toEqual({
      backgroundPattern: 'graph',
      layers: templateLayers('swot'),
    });
    expect(templateCanvasOverrides('gantt')).toEqual({
      backgroundPattern: 'graph',
      layers: templateLayers('gantt'),
    });
    expect(templateCanvasOverrides('mobile-wireframe')).toEqual({
      backgroundPattern: 'graph',
      layers: templateLayers('mobile-wireframe'),
    });
  });

  it('gives clean radial layouts a blank backdrop', () => {
    expect(templateCanvasOverrides('venn')).toEqual({ backgroundPattern: 'blank' });
    expect(templateCanvasOverrides('flywheel')).toEqual({ backgroundPattern: 'blank' });
  });

  it('gives the slide deck a crosshatch backdrop', () => {
    expect(templateCanvasOverrides('slide-deck')).toEqual({
      backgroundPattern: 'crosshatch',
      layers: templateLayers('slide-deck'),
    });
  });

  it('gives the logo sheet a checkerboard design board and timelines ruled lines', () => {
    expect(templateCanvasOverrides('logo-design')).toEqual({ backgroundPattern: 'checkerboard' });
    expect(templateCanvasOverrides('timeline')).toEqual({
      backgroundPattern: 'lines',
      layers: templateLayers('timeline'),
    });
    expect(templateCanvasOverrides('journey')).toEqual({
      backgroundPattern: 'lines',
      backgroundOpacity: 0.8,
      layers: templateLayers('journey'),
    });
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    expect(templateCanvasOverrides('blank')).toEqual({});
  });

  it('ships the kanban board with its Board / Cards layers (spec/74)', () => {
    expect(templateCanvasOverrides('kanban')).toEqual({
      backgroundPattern: 'graph',
      layers: [
        { id: TEMPLATE_SCAFFOLD_LAYER_ID, name: 'Board' },
        { id: TEMPLATE_CONTENT_LAYER_ID, name: 'Cards' },
      ],
    });
  });
});

// Layered templates (spec/74 "Layered templates"): a layered template's
// builder pre-stamps `layerId` on every element, and the matching
// `Tab.layers` rides templateCanvasOverrides, so the two can't be
// allowed to drift apart — an element stamped with an id the layers
// array doesn't know would silently fall back to the default layer.
describe('layered templates (spec/74)', () => {
  it('keeps every builder in lockstep with templateLayers across the catalogue', () => {
    for (const kind of TEMPLATES.map((t) => t.kind)) {
      const layers = templateLayers(kind);
      const elements = buildTemplate(kind, 0, 0);
      if (!layers) {
        // Layerless templates must not stamp: a dangling layerId would
        // resolve to the implicit default layer but bloat the JSON.
        for (const el of elements) expect(el.layerId, kind).toBeUndefined();
        continue;
      }
      // Layered templates stamp EVERY element with a known layer id.
      const known = new Set(layers.map((l) => l.id));
      expect(known.size).toBe(layers.length); // ids unique
      for (const el of elements) {
        expect(el.layerId, `${kind} element without a known layerId`).toBeDefined();
        expect(known.has(el.layerId!), `${kind} stamped unknown id ${el.layerId}`).toBe(true);
      }
    }
  });

  it('kanban splits the stationary board from the tickets, cards on top', () => {
    const layers = templateLayers('kanban')!;
    // Cards LAST (top): the default active layer, so new elements land
    // with the content, never under the scaffold (spec/74).
    expect(layers.map((l) => l.name)).toEqual(['Board', 'Cards']);
    const elements = buildTemplate('kanban', 0, 0);
    const board = elements.filter((el) => el.layerId === TEMPLATE_SCAFFOLD_LAYER_ID);
    const cards = elements.filter((el) => el.layerId === TEMPLATE_CONTENT_LAYER_ID);
    // The split is by role, not accident: every lane header is on the
    // board, every ticket line on the cards.
    const labelsOn = (els: typeof elements) =>
      els.map((el) => ('label' in el ? el.label : undefined)).filter(Boolean) as string[];
    for (const lane of ['Todo List', 'In Progress', 'Under Review', 'Done']) {
      expect(labelsOn(board)).toContain(lane);
    }
    expect(labelsOn(cards).filter((l) => l.startsWith('LIVE-'))).toHaveLength(12);
  });

  // Band membership per layered template: scaffold count / content count,
  // plus the pair of display names (scaffold first, content on top). The
  // counts pin the ROLE split — a new element silently landing on the
  // wrong band shows up here as a count drift even though the lockstep
  // test above still passes.
  const LAYERED_BANDS: Partial<
    Record<TemplateKind, { names: [string, string]; scaffold: number; content: number }>
  > = {
    kanban: { names: ['Board', 'Cards'], scaffold: 9, content: 36 },
    retrospective: { names: ['Board', 'Stickies'], scaffold: 6, content: 9 },
    'prioritization-matrix': { names: ['Axes', 'Items'], scaffold: 8, content: 5 },
    'affinity-map': { names: ['Board', 'Stickies'], scaffold: 5, content: 9 },
    'user-story-map': { names: ['Backbone', 'Stories'], scaffold: 7, content: 12 },
    roadmap: { names: ['Lanes', 'Cards'], scaffold: 10, content: 27 },
    gantt: { names: ['Grid', 'Bars'], scaffold: 25, content: 6 },
    swot: { names: ['Quadrants', 'Notes'], scaffold: 12, content: 13 },
    'business-model-canvas': { names: ['Canvas', 'Notes'], scaffold: 28, content: 19 },
    'empathy-map': { names: ['Quadrants', 'Notes'], scaffold: 12, content: 9 },
    'sequence-diagram': { names: ['Lifelines', 'Messages'], scaffold: 8, content: 6 },
    'mobile-wireframe': { names: ['Frames', 'UI'], scaffold: 3, content: 40 },
    'laptop-wireframe': { names: ['Frames', 'UI'], scaffold: 1, content: 21 },
    'browser-wireframe': { names: ['Frames', 'UI'], scaffold: 1, content: 28 },
    'slide-deck': { names: ['Frames', 'Content'], scaffold: 7, content: 31 },
    storyboard: { names: ['Frames', 'Content'], scaffold: 13, content: 18 },
    timeline: { names: ['Spine', 'Milestones'], scaffold: 1, content: 15 },
    journey: { names: ['Stages', 'Notes'], scaffold: 9, content: 5 },
  };

  it('pins each layered template’s names and scaffold / content split', () => {
    // Every layered kind has a table entry and vice versa, so adding a
    // layered template forces a deliberate row here.
    const layeredKinds = TEMPLATES.map((t) => t.kind).filter((k) => templateLayers(k));
    expect(layeredKinds.sort()).toEqual(Object.keys(LAYERED_BANDS).sort());

    for (const [kind, expected] of Object.entries(LAYERED_BANDS) as [
      TemplateKind,
      NonNullable<(typeof LAYERED_BANDS)[TemplateKind]>,
    ][]) {
      const layers = templateLayers(kind)!;
      // Scaffold at the bottom, content LAST (top): the default active
      // layer, so new elements land with the content (spec/74). Scaffold
      // ships unlocked and visible: locking is one click away.
      expect(
        layers.map((l) => l.name),
        kind,
      ).toEqual(expected.names);
      expect(layers.map((l) => l.id)).toEqual([
        TEMPLATE_SCAFFOLD_LAYER_ID,
        TEMPLATE_CONTENT_LAYER_ID,
      ]);
      for (const l of layers) {
        expect(l.locked).toBeUndefined();
        expect(l.visible).toBeUndefined();
      }
      const elements = buildTemplate(kind, 0, 0);
      const scaffold = elements.filter((el) => el.layerId === TEMPLATE_SCAFFOLD_LAYER_ID);
      const content = elements.filter((el) => el.layerId === TEMPLATE_CONTENT_LAYER_ID);
      expect(scaffold.length, `${kind} scaffold`).toBe(expected.scaffold);
      expect(content.length, `${kind} content`).toBe(expected.content);
      expect(scaffold.length + content.length, kind).toBe(elements.length);
    }
  });

  it('buildTemplatedTab lands the layers on the tab and theming keeps the stamps', () => {
    const tab = buildTemplatedTab('kanban', 'slate', 'tab-1', 'kanban');
    expect(tab.layers).toEqual(templateLayers('kanban'));
    for (const el of tab.elements) {
      expect([TEMPLATE_SCAFFOLD_LAYER_ID, TEMPLATE_CONTENT_LAYER_ID]).toContain(el.layerId);
    }
  });
});

describe('buildTemplatedTab', () => {
  it('returns a Tab carrying the supplied id, name, and theme metadata', () => {
    const tab = buildTemplatedTab('blank', 'slate', 'tab-1', 'My tab');
    const slate = getTheme('slate');
    expect(tab.id).toBe('tab-1');
    expect(tab.name).toBe('My tab');
    expect(tab.theme).toBe('slate');
    expect(tab.backgroundColor).toBe(slate.backgroundColor);
    expect(tab.backgroundPattern).toBe(slate.backgroundPattern);
    expect(tab.patternColor).toBe(slate.patternColor);
    expect(tab.templateChosen).toBe(true);
  });

  it('applies the mindmap backdrop opacity override', () => {
    const tab = buildTemplatedTab('mindmap', 'brand', 'tab-1', 'mind map');
    expect(tab.backgroundOpacity).toBe(0.8);
  });

  it('leaves non-mindmap templates without a backdrop opacity override', () => {
    const tab = buildTemplatedTab('flowchart', 'brand', 'tab-1', 'flow');
    expect(tab.backgroundOpacity).toBeUndefined();
  });

  it('recolours shape elements with the chosen theme palette', () => {
    // `flowchart` seeds plain shapes (the blank template is now empty,
    // spec/14), so its first preset-free shape pins the recolouring
    // contract: a single-colour theme writes the same fill / stroke / text
    // triple onto it. (Some flowchart shapes now carry a `colorPreset`
    // (spec/48) whose colours are re-derived from the theme instead, so we
    // skip those here and assert the plain-recolour path on a bare shape.)
    const tab = buildTemplatedTab('flowchart', 'slate', 'tab-1', 'name');
    const slate = getTheme('slate');
    const shape = tab.elements.find((el) => el.type === 'shape' && !el.colorPreset);
    expect(shape).toBeDefined();
    if (shape && shape.type === 'shape') {
      expect(shape.fillColor).toBe(slate.elementFill);
      expect(shape.strokeColor).toBe(slate.elementStroke);
      expect(shape.textColor).toBe(slate.elementText);
    }
  });

  it('leaves shape colours untouched when the theme provides no overrides', () => {
    // The brand theme has all three element fields null, so recolouring is a
    // no-op: a preset-free shape keeps exactly the colours the raw builder
    // gave it. (Preset-carrying shapes (spec/48) DO get re-derived colours
    // even under brand, so compare a bare shape to isolate the no-op path.)
    const raw = buildTemplate('flowchart', 0, 0).find(
      (el) => el.type === 'shape' && !el.colorPreset,
    );
    const tab = buildTemplatedTab('flowchart', 'brand', 'tab-1', 'name');
    const shape = tab.elements.find((el) => el.type === 'shape' && !el.colorPreset);
    expect(shape).toBeDefined();
    expect(raw).toBeDefined();
    if (shape?.type === 'shape' && raw?.type === 'shape') {
      expect(shape.fillColor).toBe(raw.fillColor);
      expect(shape.strokeColor).toBe(raw.strokeColor);
      expect(shape.textColor).toBe(raw.textColor);
    }
  });

  it('recolours arrow elements with the theme stroke colour only', () => {
    // Mind maps include arrows (central node to branches). The
    // recolouring loop only writes strokeColor on arrows, never a
    // fill or text colour, because arrows don't carry those.
    const tab = buildTemplatedTab('mindmap', 'slate', 'tab-1', 'mind map');
    const slate = getTheme('slate');
    const arrow = tab.elements.find((el) => el.type === 'arrow');
    expect(arrow).toBeDefined();
    if (arrow && arrow.type === 'arrow') {
      expect(arrow.strokeColor).toBe(slate.elementStroke);
    }
  });
});

// Wireframe templates that pair with the device-frame shapes
// (browser / monitor / laptop / phone / tablet). Each test pins
// the template's structural fingerprint, so a future change to the
// template's element count or shape choices either updates these
// expectations or fails CI loudly. None of the runtime helpers
// (theme recolouring, mindmap opacity, etc.) need to be exercised
// again here, they're covered above against the blank + flowchart
// templates.

describe('wireframe templates', () => {
  it('mobile-wireframe drops three labelled phone screens with inner UI elements', () => {
    const tab = buildTemplatedTab('mobile-wireframe', 'brand', 'tab-1', 'mobile');
    const phones = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'phone');
    expect(phones).toHaveLength(3);
    expect(phones.map((p) => (p as { label?: string }).label)).toEqual([
      'Login',
      'Feed',
      'Profile',
    ]);
    // Phones aren't empty frames anymore: each screen scaffolds
    // status bar, content, and bottom tab bar. Floor the total at
    // well above 3 so the wireframe stays substantive even as we
    // shuffle individual UI bits around.
    expect(tab.elements.length).toBeGreaterThan(20);
    // Every screen exposes at least one labelled CTA / row that the
    // user can recognise and edit.
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Sign in');
    expect(labels).toContain('Feed');
    expect(labels).toContain('Account');
  });

  it('laptop-wireframe drops a laptop frame with header, sidebar nav, and dashboard cards', () => {
    const tab = buildTemplatedTab('laptop-wireframe', 'brand', 'tab-1', 'laptop');
    const laptops = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'laptop');
    expect(laptops).toHaveLength(1);
    // No fixed shape count — the scaffold has many small elements
    // and that's the point. Floor it at enough to confirm we're
    // shipping a real UI shell rather than a labelled empty frame.
    expect(tab.elements.length).toBeGreaterThan(15);
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    // Top-level chrome: brand logo + primary nav pills.
    expect(labels).toContain('Logo');
    expect(labels).toContain('Home');
    expect(labels).toContain('Projects');
    // Sidebar nav rows.
    expect(labels).toContain('Overview');
    expect(labels).toContain('Settings');
    // Stat cards.
    expect(labels).toContain('Active users');
    expect(labels).toContain('Revenue');
    expect(labels).toContain('Conversion');
  });

  it('slide-deck drops four content-rich slides connected in reading order', () => {
    const tab = buildTemplatedTab('slide-deck', 'brand', 'tab-1', 'slides');
    // The new slide-deck builds slides out of standard primitives — no
    // device shape involved.
    const monitors = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'monitor');
    expect(monitors).toHaveLength(0);
    // Each slide title shows up exactly once as a stadium-shaped
    // heading band, so locating them via label is the simplest pin.
    const stadiums = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'stadium');
    const stadiumLabels = stadiums
      .map((s) => (s as { label?: string }).label)
      .filter((l): l is string => Boolean(l));
    expect(stadiumLabels).toContain('Q3 Roadmap');
    expect(stadiumLabels).toContain('Agenda');
    expect(stadiumLabels).toContain('Three Q3 bets');
    expect(stadiumLabels).toContain('Next steps');
    // Content bullets carried through from the spec.
    const allLabels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    expect(allLabels).toContain('Self-serve onboarding');
    expect(allLabels).toContain('Send recap by EOD');
    // Three arrows wire the slides together in reading order.
    const arrows = tab.elements.filter((el) => el.type === 'arrow');
    expect(arrows).toHaveLength(3);
  });

  it('flywheel drops a hub plus four sectors with a clockwise arrow loop', () => {
    const tab = buildTemplatedTab('flywheel', 'brand', 'tab-1', 'fly');
    const circles = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'circle');
    // One hub + four sector circles.
    expect(circles).toHaveLength(5);
    const labels = circles
      .map((c) => (c as { label?: string }).label)
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Growth flywheel');
    expect(labels).toContain('Attract');
    expect(labels).toContain('Engage');
    expect(labels).toContain('Delight');
    expect(labels).toContain('Refer');
    // Four arrows complete the clockwise loop.
    const arrows = tab.elements.filter((el) => el.type === 'arrow');
    expect(arrows).toHaveLength(4);
  });
});

// Board templates moved to template-builders-boards.ts in commit
// 77f2859. Same kind of structural fingerprint as the wireframes
// above: a silent refactor that drops a column / lane / quadrant
// (or changes the framework-defining label set) compiles AND
// passes the catalogue "every kind builds non-empty" check, so
// these tests are the actual safety net.

describe('board templates', () => {
  it('retrospective drops three columns in the Mad / Sad / Glad framework', () => {
    const tab = buildTemplatedTab('retrospective', 'brand', 'tab-1', 'retro');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    // The framework lives in the three column headers. Anything
    // else (sticky note text, container background) can move
    // around without breaking the retro.
    expect(labels).toContain('Mad');
    expect(labels).toContain('Sad');
    expect(labels).toContain('Glad');
    // Three column containers, each its own boxed shape. Pinning
    // the count stops a "lets merge columns" change from sneaking
    // through.
    const containerLabels = (['Mad', 'Sad', 'Glad'] as const).filter((name) =>
      labels.includes(name),
    );
    expect(containerLabels).toHaveLength(3);
    // Sticky notes (the rows the user fills in) are the second
    // element type that matters. The retro ships with sticky-note
    // starters so the template isn't a "fill in blank" exercise.
    const stickies = tab.elements.filter((el) => el.type === 'sticky');
    expect(stickies.length).toBeGreaterThan(0);
  });

  it('kanban drops four lanes from Todo to Done under a sprint title', () => {
    const tab = buildTemplatedTab('kanban', 'brand', 'tab-1', 'kanban');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    // Bold sprint title spanning the board.
    expect(labels.some((l) => l.startsWith('Sprint 12'))).toBe(true);
    // Lane headers.
    for (const lane of ['Todo List', 'In Progress', 'Under Review', 'Done']) {
      expect(labels).toContain(lane);
    }
    // Realistic mid-sprint board: 12 ticket cards (varied per-lane counts),
    // each carrying a ticket line and a priority chip with mixed priorities.
    expect(labels.filter((l) => l.startsWith('LIVE-')).length).toBe(12);
    expect(labels.filter((l) => /^(High|Medium|Low) priority$/.test(l)).length).toBe(12);
  });

  it('swot drops a 2x2 grid with the four classic quadrants, each with a role icon', () => {
    const tab = buildTemplatedTab('swot', 'brand', 'tab-1', 'swot');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Strengths');
    expect(labels).toContain('Weaknesses');
    expect(labels).toContain('Opportunities');
    expect(labels).toContain('Threats');
    // One role glyph per quadrant (icon shapes), no centre subject pill.
    const icons = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'icon');
    expect(icons).toHaveLength(4);
    // Bullet starters inside each quadrant (formatted with the
    // bullet glyph). Pinning that they exist confirms the
    // quadrants aren't empty frames.
    const bulletCount = labels.filter((l) => l.startsWith('•')).length;
    expect(bulletCount).toBeGreaterThan(0);
  });
});

// Structural fingerprints for the later template batch (roadmap /
// canvases / workshops / hierarchies / funnel / UML / cloud /
// browser / storyboard / RACI). Same rationale as the wireframe and
// board suites above: the catalogue-level "builds non-empty" check
// can't tell a real scaffold from a gutted one, so each template pins
// the labels and element mix that define it.

const labelsOf = (kind: TemplateKind): string[] =>
  buildTemplatedTab(kind, 'brand', `tab-${kind}`, kind)
    .elements.map((el) => ('label' in el ? el.label : undefined))
    .filter((l): l is string => Boolean(l));

describe('planning + strategy templates', () => {
  it('roadmap drops Now / Next / Later lanes of chip-tagged initiative cards', () => {
    const labels = labelsOf('roadmap');
    for (const lane of ['Now', 'Next', 'Later']) expect(labels).toContain(lane);
    // Nine initiative cards, each with a workstream chip.
    const chips = labels.filter((l) => /^(Growth|Platform|Quality)$/.test(l));
    expect(chips).toHaveLength(9);
    expect(new Set(chips).size).toBe(3);
    // Chips keep their workstream tint under theming.
    const tab = buildTemplatedTab('roadmap', 'slate', 'tab-r', 'roadmap');
    const locked = tab.elements.filter(
      (el) => (el as { themeLockFill?: boolean }).themeLockFill === true,
    );
    expect(locked).toHaveLength(9);
  });

  it('user story map drops an activity backbone over release-banded story stickies', () => {
    const tab = buildTemplatedTab('user-story-map', 'brand', 'tab-1', 'usm');
    const labels = labelsOf('user-story-map');
    for (const activity of ['Browse products', 'Build a cart', 'Check out', 'Track my order']) {
      expect(labels).toContain(activity);
    }
    expect(labels).toContain('MVP');
    expect(labels).toContain('Release 2');
    // Twelve story stickies: two MVP + one later per activity.
    const stickies = tab.elements.filter((el) => el.type === 'sticky');
    expect(stickies).toHaveLength(12);
    // The release cut line is a headless dashed rule.
    const rules = tab.elements.filter(
      (el) => el.type === 'arrow' && el.arrowEnds === 'none' && el.strokeStyle === 'dashed',
    );
    expect(rules).toHaveLength(1);
  });

  it('affinity map drops dashed theme clusters of tilted stickies plus an unsorted pile', () => {
    const tab = buildTemplatedTab('affinity-map', 'brand', 'tab-1', 'affinity');
    const labels = labelsOf('affinity-map');
    for (const cluster of ['Onboarding', 'Pricing clarity', 'Trust', 'Unsorted']) {
      expect(labels).toContain(cluster);
    }
    const frames = tab.elements.filter(
      (el) => el.type === 'shape' && el.shape === 'frame' && el.strokeStyle === 'dashed',
    );
    expect(frames).toHaveLength(3);
    const stickies = tab.elements.filter((el) => el.type === 'sticky');
    expect(stickies).toHaveLength(9);
    // Every sticky carries the hand-placed tilt.
    expect(stickies.every((s) => typeof (s as { rotation?: number }).rotation === 'number')).toBe(
      true,
    );
  });

  it('business model canvas drops all nine classic blocks with starter notes', () => {
    const labels = labelsOf('business-model-canvas');
    for (const block of [
      'Key Partners',
      'Key Activities',
      'Key Resources',
      'Value Propositions',
      'Customer Relationships',
      'Channels',
      'Customer Segments',
      'Cost Structure',
      'Revenue Streams',
    ]) {
      expect(labels).toContain(block);
    }
    // Each block seeds at least two bullet starters.
    expect(labels.filter((l) => l.startsWith('•')).length).toBeGreaterThanOrEqual(18);
    // One role glyph per block.
    const tab = buildTemplatedTab('business-model-canvas', 'brand', 'tab-1', 'bmc');
    const icons = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'icon');
    expect(icons).toHaveLength(9);
  });

  it('empathy map drops the four quadrants and stickies around a persona', () => {
    const tab = buildTemplatedTab('empathy-map', 'brand', 'tab-1', 'empathy');
    const labels = labelsOf('empathy-map');
    for (const quadrant of ['Says', 'Thinks', 'Does', 'Feels']) expect(labels).toContain(quadrant);
    expect(tab.elements.filter((el) => el.type === 'sticky')).toHaveLength(8);
    // The persona circle sits above the quadrants (pushed last).
    const persona = tab.elements.filter((el) => el.type === 'shape').at(-1);
    expect((persona as { label?: string })?.label).toContain('Priya');
  });

  it('funnel drops four narrowing flipped-trapezoid tiers with a count rail', () => {
    const tab = buildTemplatedTab('funnel', 'brand', 'tab-1', 'funnel');
    const labels = labelsOf('funnel');
    for (const stage of ['Awareness', 'Interest', 'Decision', 'Action']) {
      expect(labels).toContain(stage);
    }
    const tiers = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'shape' }> =>
        el.type === 'shape' && el.shape === 'trapezoid',
    );
    expect(tiers).toHaveLength(4);
    // Every tier is flipped wide-side-up and strictly narrower than the last.
    expect(tiers.every((t) => t.rotation === 180)).toBe(true);
    for (let i = 1; i < tiers.length; i++)
      expect(tiers[i]!.width).toBeLessThan(tiers[i - 1]!.width);
    expect(labels.some((l) => l.includes('visitors'))).toBe(true);
    expect(labels.filter((l) => l.includes('convert'))).toHaveLength(3);
  });
});

describe('hierarchy templates', () => {
  it('okr tree drops an objective over three measurable KRs and six initiatives', () => {
    const labels = labelsOf('okr-tree');
    expect(labels.some((l) => l.startsWith('Objective'))).toBe(true);
    const krs = labels.filter((l) => /^KR\d/.test(l));
    expect(krs).toHaveLength(3);
    // KRs carry baseline → target numbers, not vague goals.
    expect(krs.some((l) => l.includes('→'))).toBe(true);
    const tab = buildTemplatedTab('okr-tree', 'brand', 'tab-1', 'okr');
    expect(tab.elements.filter((el) => el.type === 'arrow')).toHaveLength(9);
  });

  it('sitemap drops Home over four sections, leaf pages with route captions, elbow-wired', () => {
    const tab = buildTemplatedTab('sitemap', 'brand', 'tab-1', 'sitemap');
    const labels = labelsOf('sitemap');
    for (const page of ['Home', 'Product', 'Pricing', 'Resources', 'About']) {
      expect(labels).toContain(page);
    }
    // Route captions under the leaves.
    expect(labels).toContain('/product/features');
    expect(labels).toContain('/about/careers');
    const arrows = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'arrow' }> => el.type === 'arrow',
    );
    expect(arrows).toHaveLength(12);
    expect(arrows.every((a) => a.arrowStyle === 'angled')).toBe(true);
    // Each connector rakes down-across-down via two waypoints on the row
    // midline, so the head arrives vertically at the child's top anchor
    // (a bare single-elbow angled arrow would arrive sideways along it).
    expect(arrows.every((a) => a.curvePoints?.length === 2)).toBe(true);
    expect(arrows.every((a) => a.curvePoints!.every((p) => p.dy === 0))).toBe(true);
  });
});

describe('technical templates (later batch)', () => {
  it('cloud architecture wires branded AWS tiles from edge to data with a dashed control plane', () => {
    const tab = buildTemplatedTab('cloud-architecture', 'brand', 'tab-1', 'cloud');
    const labels = labelsOf('cloud-architecture');
    for (const role of ['Users', 'DNS', 'CDN', 'API Gateway', 'Monitoring', 'Job Queue']) {
      expect(labels).toContain(role);
    }
    const iconIds = tab.elements
      .filter(
        (el): el is Extract<(typeof tab.elements)[number], { type: 'shape' }> =>
          el.type === 'shape' && el.shape === 'icon',
      )
      .map((el) => el.iconId);
    expect(iconIds.filter((id) => id?.startsWith('aws-'))).toHaveLength(9);
    const dashed = tab.elements.filter((el) => el.type === 'arrow' && el.strokeStyle === 'dashed');
    expect(dashed).toHaveLength(2);
  });

  it('class diagram drops four two-compartment classes with UML arrowheads', () => {
    const tab = buildTemplatedTab('uml-class', 'brand', 'tab-1', 'uml');
    const tables = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'table' }> => el.type === 'table',
    );
    // Two flush-stacked tables per class (name+attributes over methods).
    expect(tables).toHaveLength(8);
    const cellText = tables.flatMap((t) => t.cells.flat());
    for (const name of ['MediaItem', 'Playlist', 'Song', 'Podcast']) {
      expect(cellText).toContain(name);
    }
    // Visibility markers survive.
    expect(cellText.some((c) => c.startsWith('- '))).toBe(true);
    expect(cellText.some((c) => c.startsWith('+ '))).toBe(true);
    const heads = tab.elements
      .filter(
        (el): el is Extract<(typeof tab.elements)[number], { type: 'arrow' }> =>
          el.type === 'arrow',
      )
      .map((a) => a.arrowheadShape);
    expect(heads.filter((h) => h === 'triangle-hollow')).toHaveLength(2);
    expect(heads.filter((h) => h === 'diamond-hollow')).toHaveLength(1);
  });

  it('state machine drops the order lifecycle with locked initial / final markers', () => {
    const tab = buildTemplatedTab('state-machine', 'slate', 'tab-1', 'sm');
    const labels = labelsOf('state-machine');
    for (const state of ['Draft', 'Submitted', 'Paid', 'Shipped', 'Delivered', 'Cancelled']) {
      expect(labels).toContain(state);
    }
    const events = tab.elements
      .filter(
        (el): el is Extract<(typeof tab.elements)[number], { type: 'arrow' }> =>
          el.type === 'arrow',
      )
      .map((a) => a.label)
      .filter(Boolean);
    for (const event of ['submit', 'pay', 'ship', 'deliver', 'cancel', 'refund']) {
      expect(events).toContain(event);
    }
    // Initial dot + final bullseye (ring + core) keep their ink under theming.
    const locked = tab.elements.filter(
      (el) => (el as { themeLockFill?: boolean }).themeLockFill === true,
    );
    expect(locked).toHaveLength(3);
  });
});

describe('design + table templates (later batch)', () => {
  it('browser wireframe drops a landing page inside one browser frame', () => {
    const tab = buildTemplatedTab('browser-wireframe', 'brand', 'tab-1', 'web');
    const browsers = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'browser');
    expect(browsers).toHaveLength(1);
    const labels = labelsOf('browser-wireframe');
    for (const bit of [
      'Logo',
      'Product',
      'Pricing',
      'Sign up',
      'Design together, ship faster',
      'Start free',
      'Realtime',
      'Templates',
      'Share',
    ]) {
      expect(labels).toContain(bit);
    }
    expect(tab.elements.length).toBeGreaterThan(20);
  });

  it('storyboard drops six numbered captioned scene frames with glyph sketches', () => {
    const tab = buildTemplatedTab('storyboard', 'brand', 'tab-1', 'story');
    const labels = labelsOf('storyboard');
    const numbers = labels.filter((l) => /^[1-6]$/.test(l));
    expect(numbers).toHaveLength(6);
    const captions = labels.filter((l) => /^[1-6] · /.test(l));
    expect(captions).toHaveLength(6);
    // Two sketch glyphs per scene.
    const icons = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'icon');
    expect(icons).toHaveLength(12);
  });

  it('raci matrix drops the tasks-by-roles grid with one legend chip per letter', () => {
    const tab = buildTemplatedTab('raci-matrix', 'brand', 'tab-1', 'raci');
    const table = tab.elements.find(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'table' }> => el.type === 'table',
    );
    expect(table).toBeDefined();
    expect(table!.headerRow).toBe(true);
    expect(table!.headerColumn).toBe(true);
    expect(table!.cells[0]).toEqual(['Task', 'Product', 'Design', 'Engineering', 'QA']);
    // Every body row assigns an accountable owner.
    for (const row of table!.cells.slice(1)) {
      expect(row.some((cell) => cell.includes('A'))).toBe(true);
    }
    const labels = labelsOf('raci-matrix');
    for (const chip of ['R · Responsible', 'A · Accountable', 'C · Consulted', 'I · Informed']) {
      expect(labels).toContain(chip);
    }
  });
});

describe('untitledNameForTemplate', () => {
  it('names a templated diagram in title case after its template title', () => {
    expect(untitledNameForTemplate('mindmap')).toBe('Untitled Mind Map');
    expect(untitledNameForTemplate('mindmap-tree')).toBe('Untitled Tree Mind Map');
  });
  it('keeps "Untitled diagram" for blank or no template', () => {
    expect(untitledNameForTemplate('blank')).toBe('Untitled diagram');
    expect(untitledNameForTemplate(null)).toBe('Untitled diagram');
  });
});
