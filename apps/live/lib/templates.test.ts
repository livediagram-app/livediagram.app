import { describe, expect, it } from 'vitest';
import { buildTemplate, buildTemplatedTab } from './template-builders';
import {
  TEMPLATES,
  TEMPLATE_COLLECTIONS,
  isTemplateCollection,
  templateBrowseHref,
  templateShelfLabel,
  templateShelfTemplates,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CONTENT_LAYER_ID,
  TEMPLATE_SCAFFOLD_LAYER_ID,
  templateCanvasOverrides,
  templateCategory,
  templateLayers,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livediagram/templates';
import { ES_BOARD_LAYER_ID, eventStormingLayers } from '@livediagram/document';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" document that doesn't match the option they picked.
// The theming is the bit most likely to silently drift, so the
// tests below pin each element type's recolouring contract.

// The catalogue's shape (count + default/extra split + no kind
// drift) is load-bearing across both the picker and the marketing
// site. docs/specs/019-marketing/marketing-site.md pins "64 templates (11 default + 53 extra)" and
// docs/specs/008-canvas/canvas-and-palette.md catalogues the picker UX. These tests pin the array so
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
    'floor-plan',
    'whiteboard',
    'article',
  ];

  // Hidden templates are buildable but never listed, so every user-facing
  // count (docs/specs/019-marketing/marketing-site.md's "64 templates", the picker grids, the MCP catalogue)
  // is over the listed subset. The mechanism is generic; nothing ships
  // hidden today (the docs/specs/007-editor/guided-tour-sample.md guided-tour sample used it until the
  // interactive tour, docs/specs/007-editor/editor-tour.md, superseded it).
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 64 templates (11 default + 53 extra, matches docs/specs/019-marketing/marketing-site.md and docs/specs/008-canvas/canvas-and-palette.md)', () => {
    expect(listed).toHaveLength(64);
  });

  it('splits cleanly into 11 default + 53 extra (`extra` is catalogue metadata; the picker browses by category)', () => {
    const defaults = listed.filter((t) => !t.extra);
    const extras = listed.filter((t) => t.extra);
    expect(defaults).toHaveLength(11);
    expect(extras).toHaveLength(53);
  });

  it('ships no hidden templates (the flag is generic; docs/specs/007-editor/guided-tour-sample.md was retired by docs/specs/007-editor/editor-tour.md)', () => {
    expect(TEMPLATES.filter((t) => t.hidden)).toEqual([]);
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
      // 'blank' and 'whiteboard' are intentionally empty (docs/specs/007-editor/new-document-route.md,
      // docs/specs/023-draw-mode/draw-mode.md); every other kind seeds content. Either way the
      // switch must handle the union member.
      // An article's writing is tab data, not elements (templateCanvasOverrides).
      const empty = kind === 'blank' || kind === 'whiteboard' || kind === 'article';
      expect(tab.elements.length).toBeGreaterThan(empty ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('makes a general tab that opens in Draw, on a Grid board', () => {
    // docs/specs/007-editor/editor-modes.md "Where the mode lives": the opening mode and the Grid
    // land on every creation path through here (the template, a new tab, Quick Start, the MCP
    // worker); the tab stays a general one.
    expect(templateCanvasOverrides('whiteboard')).toEqual({
      opensIn: 'draw',
      backgroundPattern: 'graph',
    });
  });

  it('makes an article that opens in Illustrate on one article page of writing', () => {
    // docs/specs/007-editor/article-pages.md: the template's page and writing are tab data.
    const o = templateCanvasOverrides('article');
    expect(o.opensIn).toBe('illustrate');
    expect(o.pages).toEqual([expect.objectContaining({ kind: 'article', flow: 'art-brief' })]);
    expect(o.articles?.['art-brief']?.blocks.length).toBeGreaterThan(5);
  });

  it('makes an event-storming board already settled on its lanes', () => {
    // docs/specs/021-event-storming/event-storming.md "Always on a lane": the seed note is built on lane 0,
    // so a new board never needs the one-time settle.
    expect(templateCanvasOverrides('event-storming')).toMatchObject({
      kind: 'event-storming',
      esLanesSettled: true,
    });
  });

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
    expect(templateCanvasOverrides('flowchart')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
    });
    expect(templateCanvasOverrides('orgchart')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
    });
    // Layered templates (docs/specs/006-document/layers.md) additionally carry their Tab.layers.
    expect(templateCanvasOverrides('swot')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
      layers: templateLayers('swot'),
    });
    expect(templateCanvasOverrides('gantt')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
      layers: templateLayers('gantt'),
    });
    expect(templateCanvasOverrides('mobile-wireframe')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
      layers: templateLayers('mobile-wireframe'),
    });
  });

  it('gives clean radial layouts a blank backdrop', () => {
    expect(templateCanvasOverrides('venn')).toEqual({ backgroundPattern: 'blank' });
    expect(templateCanvasOverrides('flywheel')).toEqual({ backgroundPattern: 'blank' });
  });

  it('opens the slide deck in Illustrate on six Slide (16:9) pages, keeping its layers', () => {
    // canvas-and-palette.md "Templates on pages": a plain surround, the pages are the paper.
    const o = templateCanvasOverrides('slide-deck');
    expect(o).toMatchObject({
      backgroundPattern: 'blank',
      opensIn: 'illustrate',
      layers: templateLayers('slide-deck'),
    });
    expect(o.pages).toHaveLength(6);
    expect(
      o.pages!.every(
        (p) => p.size === 'wide' && p.orientation === 'landscape' && p.kind === 'infographic',
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

  it('opens the logo exploration on Square pages, and timelines get ruled lines', () => {
    const o = templateCanvasOverrides('logo-design');
    expect(o).toMatchObject({ backgroundPattern: 'blank', opensIn: 'illustrate' });
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
    expect(o.pages!.every((p) => p.size === 'square' && p.kind === 'infographic')).toBe(true);
    expect(templateCanvasOverrides('timeline')).toEqual({
      backgroundPattern: 'lines',
      backgroundOpacity: 0.6,
      layers: templateLayers('timeline'),
    });
    expect(templateCanvasOverrides('journey')).toEqual({
      backgroundPattern: 'lines',
      // The quieter of the lines rule (0.6) and the stage softening (0.8).
      backgroundOpacity: 0.6,
      layers: templateLayers('journey'),
    });
  });

  it('opens the group card on a cover and an inside, both Portrait post (4:5) pages', () => {
    const o = templateCanvasOverrides('live-card');
    expect(o).toMatchObject({ backgroundPattern: 'blank', opensIn: 'illustrate' });
    expect(o.pages?.map((p) => [p.name, p.size, p.orientation, p.kind])).toEqual([
      ['Cover', 'social', 'portrait', 'infographic'],
      ['Inside', 'social', 'portrait', 'infographic'],
    ]);
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    expect(templateCanvasOverrides('blank')).toEqual({});
  });

  it('ships the kanban board with its Board / Cards layers (docs/specs/006-document/layers.md)', () => {
    expect(templateCanvasOverrides('kanban')).toEqual({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
      layers: [
        { id: TEMPLATE_SCAFFOLD_LAYER_ID, name: 'Board' },
        { id: TEMPLATE_CONTENT_LAYER_ID, name: 'Cards' },
      ],
    });
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

  it('kanban splits the stationary board from the tickets, cards on top', () => {
    const layers = templateLayers('kanban')!;
    // Cards LAST (top): the default active layer, so new elements land
    // with the content, never under the scaffold (docs/specs/006-document/layers.md).
    expect(layers.map((l) => l.name)).toEqual(['Board', 'Cards']);
    const elements = buildTemplate('kanban', 0, 0);
    const board = elements.filter((el) => el.layerId === TEMPLATE_SCAFFOLD_LAYER_ID);
    const cards = elements.filter((el) => el.layerId === TEMPLATE_CONTENT_LAYER_ID);
    // The split is by role, not accident: every lane header is on the
    // board, every ticket line on the cards.
    const labelsOn = (els: typeof elements) =>
      els.map((el) => ('label' in el ? el.label : undefined)).filter(Boolean) as string[];
    for (const lane of ['Backlog', 'To do', 'In progress', 'Review', 'Done']) {
      expect(labelsOn(board)).toContain(lane);
    }
    expect(labelsOn(cards).filter((l) => l.startsWith('CHK-'))).toHaveLength(15);
  });

  // Band membership per layered template: scaffold count / content count,
  // plus the pair of display names (scaffold first, content on top). The
  // counts pin the ROLE split — a new element silently landing on the
  // wrong band shows up here as a count drift even though the lockstep
  // test above still passes.
  const LAYERED_BANDS: Partial<
    Record<TemplateKind, { names: [string, string]; scaffold: number; content: number }>
  > = {
    // Board: the how-to plus five lanes of container, glyph, header, count
    // chip and rule. Cards: title, goal and progress bar, then 15 tickets of
    // card, text and tag, 11 priority chips, 11 owner discs, the BLOCKED
    // badge, and the Done lane's trophy and count.
    kanban: { names: ['Board', 'Cards'], scaffold: 26, content: 73 },
    // Board: 4 column containers, 4 headers, 4 hints, 4 glyphs, the
    // subtitle, the rail hint and the Shout-outs heading. Stickies: the
    // title, 9 notes, the mood check, 2 session buttons, the actions
    // checklist, the shout-out note and its sticker.
    retrospective: { names: ['Board', 'Stickies'], scaffold: 19, content: 16 },
    // Axes: how-to, four quadrants of tile, glyph, name and rule, two axis
    // arrows and their six labels, three rail steps and the vote hint.
    // Items: title, eight ideas with their tally discs, and the vote button,
    // estimate card and commit checklist.
    'prioritization-matrix': { names: ['Axes', 'Items'], scaffold: 29, content: 20 },
    // Board: how-to, vote hint, two theme frames and the Unsorted label.
    // Stickies: title, vote button, 2 themes, 4 insights + tally discs, 12 notes.
    'affinity-map': { names: ['Board', 'Stickies'], scaffold: 5, content: 24 },
    // Backbone: how-to, journey arrow, three release lanes, three activities
    // and six tasks. Stories: title, the persona and its sticker, 20 stories.
    'user-story-map': { names: ['Backbone', 'Stories'], scaffold: 14, content: 23 },
    // Lanes: title, caption, goal pill, three horizon headers (name, timeframe,
    // three confidence dots) and the three theme lanes. Cards: nine cards of
    // body, title and outcome, plus the three Now status stickers.
    roadmap: { names: ['Lanes', 'Cards'], scaffold: 21, content: 30 },
    // Grid: title, caption, sheet, header band, Task / Owner, 3 months, 12
    // week dates, 3 group rows (band, glyph, name), 7 table rows (label or
    // glyph + label, avatar, name) and 13 rules. Bars: 3 summaries, 6
    // progress bars, the diamond with its date and rocket, 4 dependencies,
    // the AT RISK badge and the Today line + pill.
    gantt: { names: ['Grid', 'Bars'], scaffold: 65, content: 19 },
    // Quadrants: how-to, four axis labels, four quadrants of container,
    // header, glyph and prompt, and the So what? frame, glyph, heading and
    // hint. Notes: title, 12 stickies and four moves of card, chip and text.
    swot: { names: ['Quadrants', 'Notes'], scaffold: 25, content: 25 },
    // Canvas: nine blocks of container, header, glyph and fill-order chip,
    // plus the how-to and the four area-key chips. Notes: the title, 23
    // stickies and the value-proposition sticker.
    'business-model-canvas': { names: ['Canvas', 'Notes'], scaffold: 41, content: 25 },
    // Six blocks (4 quadrants + Pains / Gains) of container, header and
    // glyph, plus the persona card; notes are the 12 stickies plus the
    // persona's sticker, name and goal.
    'empathy-map': { names: ['Quadrants', 'Notes'], scaffold: 19, content: 15 },
    // Lifelines: the caption, the actor + its name, four headed boxes and
    // five lifelines. Messages: the title, five activation bars, ten
    // messages (one of them the self-call), the alt frame, its two guards
    // and divider, and the note + its anchor.
    'sequence-diagram': { names: ['Lifelines', 'Messages'], scaffold: 12, content: 22 },
    'system-architecture': { names: ['Tiers', 'Components'], scaffold: 4, content: 23 },
    // Frames: three phones, the how-to and the Notes heading.
    'mobile-wireframe': { names: ['Frames', 'UI'], scaffold: 5, content: 75 },
    // The laptop is lid, display, base and hinge notch.
    'laptop-wireframe': { names: ['Frames', 'UI'], scaffold: 4, content: 22 },
    // Frames: the browser, the how-to and the Notes heading.
    'browser-wireframe': { names: ['Frames', 'UI'], scaffold: 3, content: 55 },
    // Frames: the footer (deck name + page number) of the five content slides; the slides
    // themselves are Illustrate pages. Content: the title slide's nine pieces, each other
    // slide's kicker + headline, and its body (pains 9, steps 5, traction 3, team 12, ask 5).
    'slide-deck': { names: ['Frames', 'Content'], scaffold: 10, content: 53 },
    // Frames: six panel cards, their number chips and the how-to.
    storyboard: { names: ['Frames', 'Content'], scaffold: 13, content: 41 },
    // Spine + the three-entry status legend stay put; each of the six
    // milestones brings a dot, a title and a date, plus the Today marker + pill.
    timeline: { names: ['Spine', 'Milestones'], scaffold: 7, content: 20 },
    // Title, caption, four phase segments and the arrowhead stay put; each
    // of the six milestones brings a ring, a pinned stem, a date chip and a
    // callout card, and launch day its two stickers.
    'milestone-timeline': { names: ['Spine', 'Milestones'], scaffold: 7, content: 26 },
    // Title, caption and spine stay put; each of the seven chapters brings a
    // stem, a disc, its glyph, a callout card, the year and its month, plus
    // the trophy and cake stickers.
    'milestone-timeline-vertical': { names: ['Spine', 'Milestones'], scaffold: 3, content: 44 },
    // Title, five stage chips + their four arrows, five row bands + five
    // gutter labels, and the Feeling row's +/- cues. Content is the twenty
    // stickies, five mood faces and the four curve segments between them.
    journey: { names: ['Stages', 'Notes'], scaffold: 22, content: 29 },
    // Shell: title + outer wall + 7 rooms, their 7 zone washes, 7 captions
    // and 7 doorways; two dimension chains (4 ticks + 3 spans each); the
    // scale bar + caption; the north arrow (N, ring, arrow); and the key
    // (2 headings, the zone legend, 6 symbol rows of glyph + name).
    // Furniture is the 21 movable pieces.
    'floor-plan': { names: ['Rooms', 'Furniture'], scaffold: 64, content: 21 },
    // The plan 0002 batch. Retro formats share the Retrospective's kit.
    // Start / Stop / Continue: how-to, rail note, 3 columns + actions panel,
    // 3 lamp discs + their glyphs, actions glyph, verbs, prompts, actions
    // header + hint, From Sprint 21 heading. Stickies: title, mood check,
    // timer + vote, 18 notes (6 per column), actions + last-sprint checklists.
    'start-stop-continue': { names: ['Board', 'Stickies'], scaffold: 22, content: 24 },
    // Mad / Sad / Glad: how-to, 3 columns + actions panel, 3 emoji stickers,
    // names, prompts, actions header, hint + glyph, check-in line, Kind words
    // heading. Stickies: title, mood check, idea box, timer + vote, 18 notes
    // (6 per column), kind-words note, checklist, heart sticker.
    'mad-sad-glad': { names: ['Board', 'Stickies'], scaffold: 19, content: 26 },
    // 4Ls: how-to, rail note, numbers heading, 4 quadrants + strip, glyphs,
    // names, prompts, strip header + hint. Stickies: title, rocket, mood
    // check, timer + vote, stat row, 24 notes (6 per quadrant), 2 checklists.
    'four-ls': { names: ['Board', 'Stickies'], scaffold: 23, content: 32 },
    // Sailboat: how-to, rail note, the drawn scene (sky, sea + wake, setting
    // sun, gulls, boat, rocks, island), 3 gust arrows, 4 zones of panel, name,
    // prompt and glyph, the anchor rope + drawn anchor, actions panel, header,
    // hint + glyph, island + Shout-outs headings. Stickies: title, mood check,
    // agenda, timer + vote, 32 zone notes (8 per zone), 3 shout-outs,
    // checklist, progress bar, clap sticker.
    sailboat: { names: ['Board', 'Stickies'], scaffold: 61, content: 43 },
    // Report: caption, 4 section headings, 5 phase headers, the summary card,
    // the Blameless callout and 3 findings columns. Findings: title, 3 chips,
    // summary, stat row, 10 timeline cards, the impact spans, 5 whys, the
    // root cause, chain arrows, 9 stickies, the clover and the actions table.
    'incident-postmortem': { names: ['Report', 'Findings'], scaffold: 44, content: 84 },
    // Matrix: caption, 2 section headings, 25 score cells, 20 axis step
    // lines, 2 axis titles, 4 band chips, checklist + vote labels. Risks:
    // title, 2 chips, 7 markers (R1 to R6 + R1's residual), the residual
    // arrow, the register, the review sticky + sticker, checklist and vote.
    'risk-matrix': { names: ['Matrix', 'Risks'], scaffold: 60, content: 16 },
    // Levels: how-to, four level bands with rail tile, glyph, name and rule,
    // and the sub-opportunity rail note. Tree: title, outcome card + ring,
    // six opportunities with evidence chips, the target ribbon, three
    // solutions, six tests with verdict chips, and 15 rake lines.
    'opportunity-solution-tree': { names: ['Levels', 'Tree'], scaffold: 22, content: 47 },
    // Grid: how-to, four quadrants of tile, glyph, name and rule, two axis
    // arrows and six labels, the plan heading + note, the stance key. People:
    // title, nine people and the ghost, the move arrow, the plan table, the
    // next-step sticky and its pushpin.
    'stakeholder-map': { names: ['Grid', 'Stakeholders'], scaffold: 36, content: 15 },
    // Sheet: how-to, prompt card, the four steps, the sheet frame, 8 panel
    // frames + number chips, the invite line. Sketches: title + meta, prompt,
    // 2 stickers, timer + vote, done check, sheet name + status, the three
    // sketches and their captions, 5 empty-panel hints.
    'crazy-eights': { names: ['Sheet', 'Sketches'], scaffold: 35, content: 54 },
    // Card: how-to, the profile card's chrome, 5 panels of tint, header,
    // glyph and prompt, spectrum poles, channel glyphs, How we help band.
    // Details: title, profile facts, monogram, stat row, tags, quote, 9 notes,
    // 4 bars, 3 channels + rating, 3 needs + answers.
    'user-persona': { names: ['Card', 'Details'], scaffold: 49, content: 40 },
    // Board: how-to, 3 phase bands, 5 column heads, section labels, 4 house
    // rules, the parking bay and hints. Notes: title + sticker, purpose,
    // outcomes checklist, 5 attendees, the agenda, 4 parked stickies, 2
    // decision records, actions checklist, rating gauge, next-sync callout.
    'meeting-agenda': { names: ['Board', 'Notes'], scaffold: 37, content: 34 },
    // Planner: how-to, 3 phase bands, 3 column heads, why labels, the formula
    // guide + rewrite + SMART check, 3 card frames with section labels, the
    // check-in strip. Objectives: title + sticker, focus, 6 stickies, 2 corner
    // people, 3 objectives (chip, sticker, sentence, KRs + bars, steps,
    // support, rating) and the Today chip.
    'objectives-planner': { names: ['Planner', 'Objectives'], scaffold: 65, content: 44 },
  };

  it('pins each layered template’s names and scaffold / content split', () => {
    // Every layered kind has a table entry and vice versa, so adding a
    // layered template forces a deliberate row here. Event storming is the
    // one deliberate exception to the two-band shape — it ships FOUR stage
    // layers for the workshop views (docs/specs/021-event-storming/event-storming.md) and gets its own pin below.
    const layeredKinds = TEMPLATES.map((t) => t.kind).filter(
      (k) => k !== 'event-storming' && templateLayers(k),
    );
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

  // Event storming (docs/specs/021-event-storming/event-storming.md): three stage layers for the shared workshop
  // views — Big picture / Process / Design. The seed lives on Big picture
  // (the workshop's first stage).
  it('event storming ships ONE layer, with the whole seed on it', () => {
    const layers = templateLayers('event-storming')!;
    expect(layers).toEqual(eventStormingLayers());
    const elements = buildTemplate('event-storming', 0, 0);
    const onBoard = elements.filter((el) => el.layerId === ES_BOARD_LAYER_ID);
    // The one orange event, on the one board layer.
    expect(onBoard).toHaveLength(1);
    expect(onBoard.length).toBe(elements.length);
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

  it('steps loud patterns back behind the content and leaves quiet ones alone', () => {
    // Graph paper is the loudest, so it recedes furthest.
    expect(buildTemplatedTab('flowchart', 'brand', 'tab-1', 'flow').backgroundOpacity).toBe(0.4);
    // The dot grid is already quiet: no override.
    expect(
      buildTemplatedTab('retrospective', 'brand', 'tab-1', 'retro').backgroundOpacity,
    ).toBeUndefined();
  });

  it('recolours shape elements with the chosen theme palette', () => {
    // `flowchart` seeds plain shapes (the blank template is now empty,
    // docs/specs/007-editor/new-document-route.md), so its first preset-free shape pins the recolouring
    // contract: a single-colour theme writes the same fill / stroke / text
    // triple onto it. (Some flowchart shapes now carry a `colorPreset`
    // (docs/specs/010-palette/style-presets.md) whose colours are re-derived from the theme instead, so we
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
    // gave it. (Preset-carrying shapes (docs/specs/010-palette/style-presets.md) DO get re-derived colours
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
  it('mobile-wireframe drops a three-phone user flow joined by tap arrows', () => {
    const tab = buildTemplatedTab('mobile-wireframe', 'brand', 'tab-1', 'mobile');
    const phones = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'phone');
    expect(phones.map((p) => (p as { label?: string }).label)).toEqual([
      '1 · Menu',
      '2 · Customise',
      '3 · Order placed',
    ]);
    // The detailed structure (pins, notes, tap arrows) is pinned in
    // template-design.test.ts; here, the screens carry recognisable UI.
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    for (const l of ['Oat flat white', 'Add to order · £3.40', 'Order placed!'])
      expect(labels).toContain(l);
  });

  it('laptop-wireframe drops a front-on laptop around a working analytics dashboard', () => {
    const tab = buildTemplatedTab('laptop-wireframe', 'brand', 'tab-1', 'laptop');
    // Drawn from plain shapes, not the `laptop` device shape, whose own
    // keyboard deck took a third of the frame.
    expect(tab.elements.some((el) => el.type === 'shape' && el.shape === 'laptop')).toBe(false);
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    // Top nav, sidebar with its active page, and the page header.
    for (const l of ['Logo', 'Home', 'Projects', 'Search…', 'Overview', 'Settings', 'Last 30 days'])
      expect(labels).toContain(l);
    const shapes = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'shape' }> => el.type === 'shape',
    );
    // Only the active nav row is tinted.
    expect(shapes.filter((el) => el.colorPreset === 'soft').map((el) => el.label)).toEqual([
      'Overview',
    ]);
    // Real KPIs with deltas rather than placeholder zeros.
    const stats = shapes.find((el) => el.shape === 'stat-row')?.stats ?? [];
    expect(stats).toHaveLength(4);
    expect(stats.every((st) => st.value !== '0' && /[▲▼]/.test(st.caption))).toBe(true);
    // A weekly chart beside a recent sign-ups table.
    expect(shapes.find((el) => el.shape === 'line-chart')?.lineSeries).toHaveLength(2);
    const table = tab.elements.find((el) => el.type === 'table');
    expect(table && table.type === 'table' ? table.cells[0] : []).toEqual([
      'Customer',
      'Plan',
      'When',
    ]);
  });

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

  it('flywheel drops a hub plus four stages with a clockwise arrow loop', () => {
    const tab = buildTemplatedTab('flywheel', 'brand', 'tab-1', 'fly');
    const circles = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'circle');
    // One hub + four stage circles.
    expect(circles).toHaveLength(5);
    const labels = circles
      .map((c) => (c as { label?: string }).label)
      .filter((l): l is string => Boolean(l));
    expect(labels).toContain('Momentum');
    expect(labels).toContain('More subscribers');
    expect(labels).toContain('More weekly orders');
    expect(labels).toContain('Better farm deals');
    expect(labels).toContain('Lower box prices');
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
  it('retrospective runs from a mood check to owned action items', () => {
    const tab = buildTemplatedTab('retrospective', 'brand', 'tab-1', 'retro');
    const labels = tab.elements
      .map((el) => ('label' in el ? el.label : undefined))
      .filter((l): l is string => Boolean(l));
    // The three note columns plus the column that closes the retro out.
    for (const col of ['Went well', 'To improve', 'Ideas', 'Action items']) {
      expect(labels).toContain(col);
    }
    const shapes = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'shape' }> => el.type === 'shape',
    );
    // It opens on a fist-of-five and ships the two tools it is run with.
    expect(shapes.find((el) => el.shape === 'temperature')?.label).toBe('How did the sprint feel?');
    expect(shapes.filter((el) => el.shape === 'session-button').map((el) => el.session)).toEqual([
      { tool: 'timer', minutes: 5 },
      { tool: 'vote', dots: 3 },
    ]);
    // Every action names an owner and a day: "what · who · when".
    const actions = shapes.find((el) => el.shape === 'checklist')?.checklistItems ?? [];
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.text.split(' · ').length === 3 && !a.done)).toBe(true);
    // Nine column notes, three per column, each in its column's hue, plus the
    // shout-out.
    const stickies = tab.elements.filter((el) => el.type === 'sticky');
    expect(stickies).toHaveLength(10);
    expect(new Set(stickies.map((el) => el.fillColor)).size).toBe(4);
  });

  // The full structure pins live in template-boards.test.ts; these two check
  // the themed path (buildTemplatedTab) keeps what carries meaning.
  it('kanban keeps its tag and owner colours under a non-brand theme', () => {
    const tab = buildTemplatedTab('kanban', 'slate', 'tab-1', 'kanban');
    // The 11 owner discs lock their fills, so five people stay apart.
    const owners = tab.elements.filter(
      (el) => (el as { themeLockFill?: boolean }).themeLockFill === true,
    ) as Array<{ fillColor?: string }>;
    expect(owners).toHaveLength(11);
    expect(new Set(owners.map((el) => el.fillColor)).size).toBe(5);
    // The 15 tag chips re-derive their theme-independent preset, so the five
    // tags keep five colours rather than collapsing to the theme's fill.
    const tags = tab.elements.filter(
      (el) => el.type === 'shape' && el.shape === 'stadium' && el.colorPreset,
    ) as Array<{ fillColor?: string }>;
    expect(tags).toHaveLength(15);
    expect(new Set(tags.map((el) => el.fillColor)).size).toBe(5);
  });

  it('swot keeps each quadrant’s sticky hue under a non-brand theme', () => {
    const tab = buildTemplatedTab('swot', 'slate', 'tab-1', 'swot');
    const notes = tab.elements.filter((el) => el.type === 'sticky') as Array<{
      fillColor?: string;
    }>;
    expect(notes).toHaveLength(12);
    expect(new Set(notes.map((n) => n.fillColor)).size).toBe(4);
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
  it('roadmap drops Now / Next / Later horizons across theme swimlanes', () => {
    // The full structure pins live in template-planning.test.ts.
    const labels = labelsOf('roadmap');
    for (const horizon of ['Now', 'Next', 'Later']) expect(labels).toContain(horizon);
    for (const theme of ['Activation', 'Collaboration', 'Reliability']) {
      expect(labels).toContain(theme);
    }
  });

  // User story map and affinity map: pinned in template-boards.test.ts.

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
    // Each block seeds at least two sticky notes.
    const tab = buildTemplatedTab('business-model-canvas', 'brand', 'tab-1', 'bmc');
    expect(tab.elements.filter((el) => el.type === 'sticky').length).toBeGreaterThanOrEqual(18);
    // One role glyph per block.
    const icons = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'icon');
    expect(icons).toHaveLength(9);
  });

  it('empathy map puts a persona over the quadrants and a Pains / Gains strip', () => {
    const tab = buildTemplatedTab('empathy-map', 'brand', 'tab-1', 'empathy');
    const labels = labelsOf('empathy-map');
    for (const block of ['Says', 'Thinks', 'Does', 'Feels', 'Pains', 'Gains'])
      expect(labels).toContain(block);
    expect(tab.elements.filter((el) => el.type === 'sticky')).toHaveLength(12);
    expect(labels.some((l) => l.startsWith('Priya'))).toBe(true);
    // The persona sits above the grid, so nothing on the board overlaps a
    // block header (the centred circle it replaced covered "Feels").
    const texts = tab.elements.filter(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'text' }> => el.type === 'text',
    );
    const personaName = texts.find((el) => el.label?.startsWith('Priya'))!;
    const headers = texts.filter((el) =>
      ['Says', 'Thinks', 'Does', 'Feels'].includes(el.label ?? ''),
    );
    expect(headers).toHaveLength(4);
    for (const h of headers) expect(personaName.y + personaName.height).toBeLessThan(h.y);
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
    expect(labels).toContain('12,400');
    expect(labels.filter((l) => l.includes('move on'))).toHaveLength(3);
  });
});

// The OKR tree and sitemap pins live in template-hierarchies.test.ts with the
// other hierarchy starters.

// The cloud architecture, class diagram and state machine are pinned in
// template-technical.test.ts with the rest of the technical starters.

describe('design + table templates (later batch)', () => {
  it('browser wireframe drops an annotated landing page inside one browser frame', () => {
    const tab = buildTemplatedTab('browser-wireframe', 'brand', 'tab-1', 'web');
    const browsers = tab.elements.filter((el) => el.type === 'shape' && el.shape === 'browser');
    expect(browsers).toHaveLength(1);
    const labels = labelsOf('browser-wireframe');
    for (const bit of [
      'Pocketbook',
      'Features',
      'Pricing',
      'Start free trial',
      'Bookkeeping that does itself while you work',
      'Book a demo',
      'Snap a receipt',
      'Notes',
    ]) {
      expect(labels).toContain(bit);
    }
  });

  it('storyboard drops six numbered shots, each with an action and a sound line', () => {
    const labels = labelsOf('storyboard');
    expect(labels.filter((l) => /^[1-6]$/.test(l))).toHaveLength(6);
    // Every shot chip names a framing and a start time.
    expect(labels.filter((l) => /^[A-Z][a-z -]+ · 0:\d\d$/.test(l))).toHaveLength(6);
    expect(labels.filter((l) => /^(SFX|VO|Music):/.test(l))).toHaveLength(6);
  });

  it('raci matrix drops the tasks-by-roles grid with one legend chip per letter', () => {
    const tab = buildTemplatedTab('raci-matrix', 'brand', 'tab-1', 'raci');
    const table = tab.elements.find(
      (el): el is Extract<(typeof tab.elements)[number], { type: 'table' }> => el.type === 'table',
    );
    expect(table).toBeDefined();
    expect(table!.headerRow).toBe(true);
    expect(table!.headerColumn).toBe(true);
    expect(table!.cells[0]).toEqual([
      'Task',
      'Product · Priya',
      'Design · Tom',
      'Engineering · Sam',
      'QA · Ana',
      'Marketing · Leo',
    ]);
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
  it('names a templated document in title case after its template title', () => {
    expect(untitledNameForTemplate('mindmap')).toBe('Untitled Mind Map');
    expect(untitledNameForTemplate('mindmap-tree')).toBe('Untitled Tree Mind Map');
  });
  it('keeps "Untitled document" for blank or no template', () => {
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
    expect(untitledNameForTemplate(null)).toBe('Untitled document');
  });
});

describe('TEMPLATE_COLLECTIONS', () => {
  it('holds the brainstorming formats, mind maps first', () => {
    // docs/specs/007-editor/new-document-route.md "?browse=<collection>".
    const brainstorm = TEMPLATE_COLLECTIONS.find((c) => c.id === 'brainstorm')!;
    expect(brainstorm.label).toBe('Brainstorm');
    expect(brainstorm.kinds).toEqual([
      'mindmap',
      'mindmap-tree',
      'mindmap-bubble',
      'affinity-map',
      'fishbone',
      'event-storming',
    ]);
  });

  it('names only listed templates', () => {
    const listed = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));
    for (const c of TEMPLATE_COLLECTIONS) for (const k of c.kinds) expect(listed.has(k)).toBe(true);
  });

  it('never shares an id with a category, so one view id names either', () => {
    const categories = new Set<string>(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const c of TEMPLATE_COLLECTIONS) expect(categories.has(c.id)).toBe(false);
  });

  it('links a collection into the wizard', () => {
    expect(templateBrowseHref('brainstorm')).toBe('/new?browse=brainstorm');
    expect(isTemplateCollection('brainstorm')).toBe(true);
    expect(isTemplateCollection('mindmaps')).toBe(false);
  });
});

describe('templateShelfTemplates', () => {
  const listed = TEMPLATES.filter((t) => !t.hidden);
  it('lists a collection in its own order', () => {
    expect(templateShelfTemplates('brainstorm', listed).map((t) => t.kind)).toEqual(
      TEMPLATE_COLLECTIONS[0]!.kinds,
    );
  });

  it('lists a category in the given order, without the quick-picks', () => {
    const kinds = templateShelfTemplates('flowcharts', listed).map((t) => t.kind);
    expect(kinds).toContain('flowchart');
    expect(kinds).not.toContain('blank');
  });

  it('names a shelf', () => {
    expect(templateShelfLabel('brainstorm')).toBe('Brainstorm');
    expect(templateShelfLabel('planning')).toBe('Agile');
  });
});
