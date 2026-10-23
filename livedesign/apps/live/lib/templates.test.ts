import { describe, expect, it } from 'vitest';
import { buildTemplate, buildTemplatedTab } from './template-builders';
import {
  BLANK_TEMPLATE_FOR_MODE,
  isBlankTemplate,
  templateEditorMode,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CONTENT_LAYER_ID,
  TEMPLATE_SCAFFOLD_LAYER_ID,
  templateCanvasOverrides,
  templateCategory,
  templateLayers,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livedesign/templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" design that doesn't match the option they picked.
// The theming is the bit most likely to silently drift, so the
// tests below pin each element type's recolouring contract.

// The catalogue's shape (count + default/extra split + no kind
// drift) is load-bearing across both the picker and the marketing
// site: the Pages templates (docs/specs/008-canvas/canvas-and-palette.md "Templates") and the
// Blank Tab. These tests pin the array so the catalogue can't silently drift.
describe('TEMPLATES catalogue', () => {
  // List of every TemplateKind union member, kept in lockstep with
  // the catalogue. If a new kind lands in the union, both this list
  // AND the catalogue must grow; the test below catches a drift in
  // either direction.
  const ALL_KINDS: TemplateKind[] = [
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
  ];

  // Hidden templates are buildable but never listed, so every user-facing
  // count (the picker grids, the MCP catalogue) is over the listed subset.
  // The mechanism is generic; nothing ships hidden today.
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 15 templates (1 default + 14 extra)', () => {
    expect(listed).toHaveLength(15);
  });

  it('splits cleanly into 1 default + 14 extra (`extra` is catalogue metadata; the picker browses by category)', () => {
    const defaults = listed.filter((t) => !t.extra);
    const extras = listed.filter((t) => t.extra);
    expect(defaults).toHaveLength(1);
    expect(extras).toHaveLength(14);
  });

  it('ships no hidden templates', () => {
    expect(TEMPLATES.filter((t) => t.hidden)).toEqual([]);
  });

  it('has no duplicate kinds (guards against accidental copy-paste in the catalogue)', () => {
    const kinds = TEMPLATES.map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('assigns every template but the blanks to a known category (the picker groups templates by category)', () => {
    const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      const category = templateCategory(t.kind);
      if (isBlankTemplate(t.kind)) expect(category, t.kind).toBeNull();
      else expect(category !== null && known.has(category), t.kind).toBe(true);
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
      // The blanks are intentionally empty (docs/specs/007-editor/new-design-route.md): Blank Tab and Blank
      // Illustration are one empty page that asks what it is for, a blank of a page kind one empty page of its kind.
      // Photo Edit is one unstarted photo page (docs/specs/031-photo/photo-pages.md). Every other kind seeds
      // content. Either way the switch must handle the union member.
      const empty = isBlankTemplate(kind) || kind === 'photo-edit';
      expect(tab.elements.length).toBeGreaterThan(empty ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('opens the logo exploration on Logo pages', () => {
    const o = templateCanvasOverrides('logo-design');
    expect(o).toMatchObject({ backgroundPattern: 'blank', opensIn: 'pages' });
    // Six lockup artboards, then the palette.
    expect(o.pages?.map((p) => p.name)).toEqual([
      'Horizontal',
      'Stacked',
      'App Icon',
      'Horizontal + Tagline',
      'Stacked + Tagline',
      'One Colour',
      'Palette',
    ]);
    // Each lockup and the palette on the logo artboard.
    expect(o.pages!.every((p) => p.size === 'logo' && p.kind === 'logo')).toBe(true);
  });

  it('leaves the blank template to inherit the theme backdrop, opening in Pages', () => {
    expect(templateCanvasOverrides('blank')).toEqual({ opensIn: 'pages' });
  });
});

// Layered templates (docs/specs/006-design/layers.md "Layered templates"): a layered template's
// builder pre-stamps `layerId` on every element, and the matching
// `Tab.layers` rides templateCanvasOverrides, so the two can't be
// allowed to drift apart — an element stamped with an id the layers
// array doesn't know would silently fall back to the default layer.
describe('layered templates (docs/specs/006-design/layers.md)', () => {
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

  // Band membership per layered template: scaffold count / content count,
  // plus the pair of display names (scaffold first, content on top). The
  // counts pin the ROLE split — a new element silently landing on the
  // wrong band shows up here as a count drift even though the lockstep
  // test above still passes.
  const LAYERED_BANDS: Partial<
    Record<TemplateKind, { names: [string, string]; scaffold: number; content: number }>
  > = {};

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
      // layer, so new elements land with the content (docs/specs/006-design/layers.md). Scaffold
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

  it('recolours shape elements with the chosen theme palette', () => {
    // The website wireframe's first preset-free shape pins the recolouring contract: a single-colour theme writes the same
    // fill / stroke / text triple onto it. (Shapes carrying a `colorPreset` (docs/specs/010-palette/style-presets.md)
    // have their colours re-derived from the theme instead, so we skip those here and assert the plain-recolour path
    // on a bare shape.)
    const tab = buildTemplatedTab('wireframe-website', 'slate', 'tab-1', 'name');
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
    // gave it. (Preset-carrying shapes (docs/specs/010-palette/style-presets.md) DO get re-derived colours
    // even under brand, so compare a bare shape to isolate the no-op path.)
    const raw = buildTemplate('wireframe-website', 0, 0).find(
      (el) => el.type === 'shape' && !el.colorPreset,
    );
    const tab = buildTemplatedTab('wireframe-website', 'brand', 'tab-1', 'name');
    const shape = tab.elements.find((el) => el.type === 'shape' && !el.colorPreset);
    expect(shape).toBeDefined();
    expect(raw).toBeDefined();
    if (shape?.type === 'shape' && raw?.type === 'shape') {
      expect(shape.fillColor).toBe(raw.fillColor);
      expect(shape.strokeColor).toBe(raw.strokeColor);
      expect(shape.textColor).toBe(raw.textColor);
    }
  });
});

describe('untitledNameForTemplate', () => {
  it('names a templated design in title case after its template title', () => {
    expect(untitledNameForTemplate('logo-design')).toBe('Untitled Logo Design');
    expect(untitledNameForTemplate('wireframe-website')).toBe('Untitled Website Wireframe');
  });
  it('keeps "Untitled design" for blank or no template', () => {
    expect(untitledNameForTemplate('blank')).toBe('Untitled design');
    expect(untitledNameForTemplate(null)).toBe('Untitled design');
  });
});

// Templates (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"): every template opens in Pages, the one mode, and
// the mode's blank is of that mode.
describe('templateEditorMode', () => {
  it('is the mode every template opens in', () => {
    for (const t of TEMPLATES) {
      expect(templateEditorMode(t.kind), t.kind).toBe('pages');
      expect(templateCanvasOverrides(t.kind).opensIn, t.kind).toBe('pages');
    }
  });

  it('gives the mode a blank of its own mode', () => {
    for (const [mode, kind] of Object.entries(BLANK_TEMPLATE_FOR_MODE)) {
      expect(templateEditorMode(kind)).toBe(mode);
    }
  });

  // A session tool could be started but never watched or ended: Pages has no Session strip.
  it('ships no template carrying a session tool', () => {
    for (const t of TEMPLATES) {
      expect(
        buildTemplate(t.kind, 0, 0).some((e) => 'session' in e && e.session),
        t.kind,
      ).toBe(false);
    }
  });
});
