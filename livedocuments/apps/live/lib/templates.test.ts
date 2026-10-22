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
} from '@livedocuments/templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" document that doesn't match the option they picked.
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
    'blank-slide-deck',
    'blank-article',
    'blank-infographic',
    'blank-logo',
    'blank-wireframe-phone',
    'blank-wireframe-tablet',
    'blank-wireframe-browser',
    'blank-wireframe-laptop',
    'blank-wireframe-watch',
    'slide-deck',
    'logo-design',
    'wireframe-mobile-app',
    'wireframe-website',
    'wireframe-dashboard',
    'wireframe-tablet-app',
    'wireframe-watch-app',
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
  ];

  // Hidden templates are buildable but never listed, so every user-facing
  // count (the picker grids, the MCP catalogue) is over the listed subset.
  // The mechanism is generic; nothing ships hidden today.
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 35 templates (1 default + 34 extra)', () => {
    expect(listed).toHaveLength(35);
  });

  it('splits cleanly into 1 default + 34 extra (`extra` is catalogue metadata; the picker browses by category)', () => {
    const defaults = listed.filter((t) => !t.extra);
    const extras = listed.filter((t) => t.extra);
    expect(defaults).toHaveLength(1);
    expect(extras).toHaveLength(34);
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
      // The blanks are intentionally empty (docs/specs/007-editor/new-document-route.md): Blank Tab and Blank
      // Illustration are one empty page that asks what it is for, a blank of a page kind one empty page of its kind.
      // An article's writing is tab data, not elements (templateCanvasOverrides). Every other kind seeds content.
      // Either way the switch must handle the union member.
      const empty = isBlankTemplate(kind) || kind === 'article' || kind === 'working-backwards';
      expect(tab.elements.length).toBeGreaterThan(empty ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('makes an article that opens in Pages on one article page of writing', () => {
    // docs/specs/007-editor/article-pages.md: the template's page and writing are tab data.
    const o = templateCanvasOverrides('article');
    expect(o.opensIn).toBe('pages');
    expect(o.pages).toEqual([expect.objectContaining({ kind: 'article', flow: 'art-brief' })]);
    expect(o.articles?.['art-brief']?.blocks.length).toBeGreaterThan(5);
  });

  // docs/specs/008-canvas/canvas-and-palette.md "Templates": Working Backwards is a PR/FAQ article in the Report look.
  it('makes Working Backwards a PR/FAQ article: press release, a page break, both FAQs and a review list', () => {
    const o = templateCanvasOverrides('working-backwards');
    expect(o.opensIn).toBe('pages');
    expect(o.pages).toEqual([expect.objectContaining({ kind: 'article', flow: 'art-prfaq' })]);
    const flow = o.articles!['art-prfaq']!;
    expect(flow.style).toEqual({ look: 'report' });
    const text = (b: (typeof flow.blocks)[number]) =>
      'runs' in b ? b.runs.map((r) => r.text).join('') : '';
    const styled = (style: string) =>
      flow.blocks.filter((b) => b.type === 'paragraph' && b.style === style).map(text);
    expect(flow.blocks[0]).toMatchObject({ type: 'paragraph', style: 'title' });
    expect(flow.blocks[1]).toMatchObject({ type: 'paragraph', style: 'subtitle' });
    expect(styled('h1')).toEqual(['Customer FAQ', 'Internal FAQ', 'Before the review']);
    expect(flow.blocks.filter((b) => b.type === 'pageBreak')).toHaveLength(1);
    expect(styled('quote')).toHaveLength(2);
    // Every block has its own id, the same on every build.
    const ids = flow.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      templateCanvasOverrides('working-backwards').articles!['art-prfaq']!.blocks.map((b) => b.id),
    ).toEqual(ids);
    // No raw Markdown survives the read.
    expect(flow.blocks.map(text).join(' ')).not.toMatch(/\*\*|^#|\[ \]/);
  });

  it('opens the slide deck in Pages on six 16:9 slide pages, keeping its layers', () => {
    // canvas-and-palette.md "Templates on pages": a plain surround, the pages are the paper.
    const o = templateCanvasOverrides('slide-deck');
    expect(o).toMatchObject({
      backgroundPattern: 'blank',
      opensIn: 'pages',
      layers: templateLayers('slide-deck'),
    });
    expect(o.pages).toHaveLength(6);
    expect(
      o.pages!.every(
        (p) => p.size === 'slide' && p.orientation === 'landscape' && p.kind === 'slide',
      ),
    ).toBe(true);
    expect(o.pages!.map((p) => p.id)).toEqual([
      'page-1',
      'page-2',
      'page-3',
      'page-4',
      'page-5',
      'page-6',
    ]);
  });

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
    // Each lockup on the logo artboard; the palette on a Square infographic page.
    expect(o.pages!.slice(0, 6).every((p) => p.size === 'logo' && p.kind === 'logo')).toBe(true);
    expect(o.pages![6]).toMatchObject({ size: 'square', kind: 'infographic' });
  });

  it('opens the group card on a cover and an inside, both Portrait post (4:5) pages', () => {
    const o = templateCanvasOverrides('live-card');
    expect(o).toMatchObject({ backgroundPattern: 'blank', opensIn: 'pages' });
    expect(o.pages?.map((p) => [p.name, p.size, p.orientation, p.kind])).toEqual([
      ['Cover', 'social', 'portrait', 'infographic'],
      ['Inside', 'social', 'portrait', 'infographic'],
    ]);
  });

  it('leaves the blank template to inherit the theme backdrop, opening in Pages', () => {
    expect(templateCanvasOverrides('blank')).toEqual({ opensIn: 'pages' });
  });
});

// Layered templates (docs/specs/006-document/layers.md "Layered templates"): a layered template's
// builder pre-stamps `layerId` on every element, and the matching
// `Tab.layers` rides templateCanvasOverrides, so the two can't be
// allowed to drift apart — an element stamped with an id the layers
// array doesn't know would silently fall back to the default layer.
describe('layered templates (docs/specs/006-document/layers.md)', () => {
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
  > = {
    // Frames: the footer (deck name + page number) of the five content slides; the slides
    // themselves are pages. Content: the title slide's nine pieces, each other
    // slide's kicker + headline, and its body (pains 9, steps 5, traction 3, team 12, ask 5).
    'slide-deck': { names: ['Frames', 'Content'], scaffold: 10, content: 63 },
    // Frames: six panel cards, their number chips and the how-to.
    storyboard: { names: ['Frames', 'Content'], scaffold: 13, content: 41 },
    // Shell: title + outer wall + 7 rooms, their 7 zone washes, 7 captions
    // and 7 doorways; two dimension chains (4 ticks + 3 spans each); the
    // scale bar + caption; the north arrow (N, ring, arrow); and the key
    // (2 headings, the zone legend, 6 symbol rows of glyph + name).
    // Furniture is the 21 movable pieces.
    'floor-plan': { names: ['Rooms', 'Furniture'], scaffold: 64, content: 21 },
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
      // layer, so new elements land with the content (docs/specs/006-document/layers.md). Scaffold
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
    const tab = buildTemplatedTab('slide-deck', 'slate', 'tab-1', 'slides');
    expect(tab.layers).toEqual(templateLayers('slide-deck'));
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

  it('recolours shape elements with the chosen theme palette', () => {
    // The storyboard's first preset-free shape pins the recolouring contract: a single-colour theme writes the same
    // fill / stroke / text triple onto it. (Shapes carrying a `colorPreset` (docs/specs/010-palette/style-presets.md)
    // have their colours re-derived from the theme instead, so we skip those here and assert the plain-recolour path
    // on a bare shape.)
    const tab = buildTemplatedTab('storyboard', 'slate', 'tab-1', 'name');
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
    const raw = buildTemplate('storyboard', 0, 0).find(
      (el) => el.type === 'shape' && !el.colorPreset,
    );
    const tab = buildTemplatedTab('storyboard', 'brand', 'tab-1', 'name');
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

// Structural fingerprints: the catalogue-level "builds non-empty" check can't tell a real scaffold from a gutted
// one, so each template pins the labels and element mix that define it.

const labelsOf = (kind: TemplateKind): string[] =>
  buildTemplatedTab(kind, 'brand', `tab-${kind}`, kind)
    .elements.map((el) => ('label' in el ? el.label : undefined))
    .filter((l): l is string => Boolean(l));

describe('slide deck and storyboard templates', () => {
  it('slide-deck drops a six-slide pitch with speaker notes', () => {
    const tab = buildTemplatedTab('slide-deck', 'brand', 'tab-1', 'slides');
    // Built from standard primitives, no device shape.
    expect(tab.elements.some((el) => el.type === 'shape' && el.shape === 'monitor')).toBe(false);
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    for (const kicker of ['The problem', 'The solution', 'Traction', 'The team', 'The ask'])
      expect(labels).toContain(kicker);
    // Reading order rides the page numbers, not arrows.
    expect(tab.elements.filter((el) => el.type === 'arrow')).toHaveLength(0);
  });

  it('storyboard drops six numbered shots, each with an action and a sound line', () => {
    const labels = labelsOf('storyboard');
    expect(labels.filter((l) => /^[1-6]$/.test(l))).toHaveLength(6);
    // Every shot chip names a framing and a start time.
    expect(labels.filter((l) => /^[A-Z][a-z -]+ · 0:\d\d$/.test(l))).toHaveLength(6);
    expect(labels.filter((l) => /^(SFX|VO|Music):/.test(l))).toHaveLength(6);
  });
});

describe('untitledNameForTemplate', () => {
  it('names a templated document in title case after its template title', () => {
    expect(untitledNameForTemplate('slide-deck')).toBe('Untitled Slide Deck');
    expect(untitledNameForTemplate('event-poster')).toBe('Untitled Event Poster');
  });
  it('keeps "Untitled document" for blank or no template', () => {
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
    expect(untitledNameForTemplate(null)).toBe('Untitled document');
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
