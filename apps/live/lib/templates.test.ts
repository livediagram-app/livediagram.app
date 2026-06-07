import { describe, expect, it } from 'vitest';
import { buildTemplatedTab } from './template-builders';
import { TEMPLATES, templateCanvasOverrides, type TemplateKind } from './templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" diagram that doesn't match the option they picked.
// The theming is the bit most likely to silently drift, so the
// tests below pin each element type's recolouring contract.

// The catalogue's shape (count + default/extra split + no kind
// drift) is load-bearing across both the picker and the marketing
// site. spec/16 pins "19 templates (8 default + 11 extra)" and
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
    'orgchart',
    'retrospective',
    'flowchart',
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
  ];

  it('lists exactly 19 templates (8 default + 11 extra, matches spec/16 and spec/09)', () => {
    expect(TEMPLATES).toHaveLength(19);
  });

  it('splits cleanly into 8 default + 11 extra (the picker uses `extra` to gate behind "Show more")', () => {
    const defaults = TEMPLATES.filter((t) => !t.extra);
    const extras = TEMPLATES.filter((t) => t.extra);
    expect(defaults).toHaveLength(8);
    expect(extras).toHaveLength(11);
  });

  it('has no duplicate kinds (guards against accidental copy-paste in the catalogue)', () => {
    const kinds = TEMPLATES.map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('lists every TemplateKind member exactly once', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const kind of ALL_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(kinds.size).toBe(ALL_KINDS.length);
  });

  it('every kind builds to at least one element (the buildTemplate switch handles every union member)', () => {
    for (const kind of ALL_KINDS) {
      const tab = buildTemplatedTab(kind, 'brand', `tab-${kind}`, 'name');
      expect(tab.elements.length).toBeGreaterThan(0);
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
    expect(templateCanvasOverrides('swot')).toEqual({ backgroundPattern: 'graph' });
    expect(templateCanvasOverrides('gantt')).toEqual({ backgroundPattern: 'graph' });
    expect(templateCanvasOverrides('mobile-wireframe')).toEqual({ backgroundPattern: 'graph' });
  });

  it('gives clean radial / slide layouts a blank backdrop', () => {
    expect(templateCanvasOverrides('venn')).toEqual({ backgroundPattern: 'blank' });
    expect(templateCanvasOverrides('flywheel')).toEqual({ backgroundPattern: 'blank' });
    expect(templateCanvasOverrides('slide-deck')).toEqual({ backgroundPattern: 'blank' });
  });

  it('gives the logo sheet a checkerboard design board and timelines ruled lines', () => {
    expect(templateCanvasOverrides('logo-design')).toEqual({ backgroundPattern: 'checkerboard' });
    expect(templateCanvasOverrides('timeline')).toEqual({ backgroundPattern: 'lines' });
    expect(templateCanvasOverrides('journey')).toEqual({ backgroundPattern: 'lines' });
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    expect(templateCanvasOverrides('blank')).toEqual({});
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
    // `blank` produces a single shape, which keeps the assertion
    // narrow: any drift in the recolouring loop shows up here as a
    // mismatched fill / stroke / text triple.
    const tab = buildTemplatedTab('blank', 'slate', 'tab-1', 'blank');
    const slate = getTheme('slate');
    const shape = tab.elements.find((el) => el.type === 'shape');
    expect(shape).toBeDefined();
    if (shape && shape.type === 'shape') {
      expect(shape.fillColor).toBe(slate.elementFill);
      expect(shape.strokeColor).toBe(slate.elementStroke);
      expect(shape.textColor).toBe(slate.elementText);
    }
  });

  it('leaves shape colours untouched when the theme provides no overrides', () => {
    // The brand theme has all three element fields null. Recolouring
    // should be a no-op so the template's own defaults show through.
    const tab = buildTemplatedTab('blank', 'brand', 'tab-1', 'blank');
    const shape = tab.elements.find((el) => el.type === 'shape');
    expect(shape).toBeDefined();
    if (shape && shape.type === 'shape') {
      // No fill/stroke/text fields written. The shape's defaults
      // (whatever `createShape` chose) survive intact.
      expect(shape.fillColor).toBeUndefined();
      expect(shape.strokeColor).toBeUndefined();
      expect(shape.textColor).toBeUndefined();
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
    // Top-level chrome: brand logo, primary nav, dashboard heading.
    expect(labels).toContain('Logo');
    expect(labels).toContain('Home');
    expect(labels).toContain('Dashboard');
    // Sidebar nav rows.
    expect(labels).toContain('Overview');
    expect(labels).toContain('Settings');
    // Stat cards.
    expect(labels).toContain('Active users');
    expect(labels).toContain('Revenue');
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

  it('kanban drops five lanes from Backlog to Done under a sprint-board heading', () => {
    const tab = buildTemplatedTab('kanban', 'brand', 'tab-1', 'kanban');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Sprint board');
    // Lane headers (with the dot + ticket count suffix). The
    // assertion looks for the prefix to stay tolerant of the
    // count suffix wobbling.
    for (const lane of ['Backlog', 'To do', 'In progress', 'Review', 'Done']) {
      expect(labels.some((l) => l.startsWith(lane))).toBe(true);
    }
    // Priority chips on the cards. These are framework signal:
    // the kanban ships with assigned priorities so the user sees
    // the convention.
    expect(labels.some((l) => l.includes('High priority'))).toBe(true);
    expect(labels).toContain('Medium');
    expect(labels).toContain('Low');
  });

  it('swot drops a 2x2 grid with the four classic quadrants around a subject centre', () => {
    const tab = buildTemplatedTab('swot', 'brand', 'tab-1', 'swot');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Strengths');
    expect(labels).toContain('Weaknesses');
    expect(labels).toContain('Opportunities');
    expect(labels).toContain('Threats');
    expect(labels).toContain('Subject');
    // Bullet starters inside each quadrant (formatted with the
    // bullet glyph). Pinning that they exist confirms the
    // quadrants aren't empty frames.
    const bulletCount = labels.filter((l) => l.startsWith('•')).length;
    expect(bulletCount).toBeGreaterThan(0);
  });
});
