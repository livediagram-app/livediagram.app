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
} from '@livehuddle/templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" document that doesn't match the option they picked.
// The theming is the bit most likely to silently drift, so the
// tests below pin each element type's recolouring contract.

// The catalogue's shape (count + default/extra split + no kind
// drift) is load-bearing across both the picker and the marketing
// site. docs/specs/019-marketing/marketing-site.md pins "39 templates (2 default + 37 extra)" and
// docs/specs/008-canvas/canvas-and-palette.md catalogues the picker UX. These tests pin the array so
// either the spec or the catalogue can't silently drift away from
// the other.
describe('TEMPLATES catalogue', () => {
  // List of every TemplateKind union member, kept in lockstep with
  // the catalogue. If a new kind lands in the union, both this list
  // AND the catalogue must grow; the test below catches a drift in
  // either direction.
  const ALL_KINDS: TemplateKind[] = [
    'retrospective',
    'swot',
    'journey',
    'prioritization-matrix',
    'roadmap',
    'raci-matrix',
    'user-story-map',
    'affinity-map',
    'lean-coffee',
    'brainstorm',
    'workshop-board',
    'town-hall',
    'pub-quiz',
    'icebreaker-questions',
    'virtual-office',
    'coworking-space',
    'team-pod',
    'all-hands-hall',
    'two-truths-and-a-lie',
    'would-you-rather',
    'people-bingo',
    'business-model-canvas',
    'empathy-map',
    'start-stop-continue',
    'mad-sad-glad',
    'four-ls',
    'sailboat',
    'incident-postmortem',
    'opportunity-solution-tree',
    'crazy-eights',
    'stakeholder-map',
    'risk-matrix',
    'value-proposition-canvas',
    'user-persona',
    'meeting-agenda',
    'objectives-planner',
    'pestle-analysis',
    'kwl-chart',
    'blank-session',
  ];

  // Hidden templates are buildable but never listed, so every user-facing
  // count (docs/specs/019-marketing/marketing-site.md's "39 templates", the picker grids, the MCP catalogue)
  // is over the listed subset. The mechanism is generic; nothing ships
  // hidden today (the guided-tour sample used it until the
  // interactive tour, docs/specs/007-editor/editor-tour.md, superseded it).
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 39 templates (2 default + 37 extra, matches docs/specs/019-marketing/marketing-site.md and docs/specs/008-canvas/canvas-and-palette.md)', () => {
    expect(listed).toHaveLength(39);
  });

  it('splits cleanly into 2 default + 37 extra (`extra` is catalogue metadata; the picker browses by category)', () => {
    const defaults = listed.filter((t) => !t.extra);
    const extras = listed.filter((t) => t.extra);
    expect(defaults).toHaveLength(2);
    expect(extras).toHaveLength(37);
  });

  it('ships no hidden templates (the flag is generic; docs/specs/007-editor/editor-tour.md has no sample)', () => {
    expect(TEMPLATES.filter((t) => t.hidden)).toEqual([]);
  });

  it('has no duplicate kinds (guards against accidental copy-paste in the catalogue)', () => {
    const kinds = TEMPLATES.map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('assigns every template but the blank to a known category (the picker groups templates by category)', () => {
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
      // The blank, an empty session tab, is intentionally empty (docs/specs/007-editor/new-document-route.md);
      // every other kind seeds content. Either way the switch must handle the union member.
      const empty = kind === 'blank-session';
      expect(tab.elements.length).toBeGreaterThan(empty ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('gives the user journey ruled lines', () => {
    expect(templateCanvasOverrides('journey')).toEqual({
      backgroundPattern: 'lines',
      // The quieter of the lines rule (0.6) and the stage softening (0.8).
      backgroundOpacity: 0.6,
      layers: templateLayers('journey'),
      opensIn: 'workshop',
    });
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    // docs/specs/007-editor/editor-modes.md: Workshop is the one mode, and it lands on every creation path through
    // here (the template, a new tab, Quick Start, the MCP worker).
    expect(templateCanvasOverrides('blank-session')).toEqual({ opensIn: 'workshop' });
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
    // Board: 4 column containers, 4 headers, 4 hints, 4 glyphs, the
    // subtitle, the rail hint, and the numbers, From Sprint 13 and Shout-outs
    // headings. Stickies: the title, 24 notes, the mood check, 2 session
    // buttons, the stat row, the two checklists, the shout-out note and its
    // sticker.
    retrospective: { names: ['Board', 'Stickies'], scaffold: 21, content: 33 },
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
    // Title, five stage chips + their four arrows, five row bands + five
    // gutter labels, and the Feeling row's +/- cues. Content is the twenty
    // stickies, five mood faces and the four curve segments between them.
    journey: { names: ['Stages', 'Notes'], scaffold: 22, content: 29 },
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
    // Board: the subtitle, the question's paper and heading, the rail note, 4 column panels with their
    // header, glyph and hint. Stickies: the title, the question, the timer and vote, and 16 ideas.
    brainstorm: { names: ['Board', 'Stickies'], scaffold: 20, content: 20 },
    // Board: the subtitle, the icebreaker's paper and heading, 3 column panels with their header, glyph
    // and hint, the Out of scope and Parking lot headings and the note under the agenda. Stickies: the
    // title, the mood check, the icebreaker and its timer, the goals, 2 out-of-scope notes, the agenda,
    // the vote, 4 rules and a parked note.
    'workshop-board': { names: ['Board', 'Stickies'], scaffold: 18, content: 14 },
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
    // Canvas: caption, 2 titles, 3 sections, 3 headings (3 each), the circle, 2 chords, 3 headings (3 each), 3 rail
    // labels. Notes: title, 4 + 3 + 3 map notes, 12 profile notes and their ranks, 4 fit lines, the rail card,
    // timer, vote and rating.
    'value-proposition-canvas': { names: ['Canvas', 'Notes'], scaffold: 30, content: 43 },
    // Lenses: how-to, the rail's heading and steps, 6 lenses (4 each), the closing (4). Notes: title, the question,
    // timer and vote, 18 notes, the checklist.
    'pestle-analysis': { names: ['Lenses', 'Notes'], scaffold: 31, content: 23 },
    // Chart: how-to, the rail's heading and steps, 3 columns (4 each). Notes: title, the question, timer and vote,
    // 12 notes.
    'kwl-chart': { names: ['Chart', 'Notes'], scaffold: 15, content: 16 },
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
    const tab = buildTemplatedTab('retrospective', 'slate', 'tab-1', 'retrospective');
    expect(tab.layers).toEqual(templateLayers('retrospective'));
    for (const el of tab.elements) {
      expect([TEMPLATE_SCAFFOLD_LAYER_ID, TEMPLATE_CONTENT_LAYER_ID]).toContain(el.layerId);
    }
  });
});

describe('buildTemplatedTab', () => {
  it('returns a Tab carrying the supplied id, name, and theme metadata', () => {
    const tab = buildTemplatedTab('blank-session', 'slate', 'tab-1', 'My tab');
    const slate = getTheme('slate');
    expect(tab.id).toBe('tab-1');
    expect(tab.name).toBe('My tab');
    expect(tab.theme).toBe('slate');
    expect(tab.backgroundColor).toBe(slate.backgroundColor);
    expect(tab.backgroundPattern).toBe(slate.backgroundPattern);
    expect(tab.patternColor).toBe(slate.patternColor);
    expect(tab.templateChosen).toBe(true);
  });
});

// Board templates moved to template-builders-boards.ts in commit
// 77f2859. Same kind of structural fingerprint as the slide deck
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
    // Last sprint's actions are checked in under this one's: one done.
    const last = shapes.filter((el) => el.shape === 'checklist')[1]?.checklistItems ?? [];
    expect(last.some((a) => a.done)).toBe(true);
    // Twenty-four column notes, eight per column, each in its column's hue,
    // plus the shout-out.
    const stickies = tab.elements.filter((el) => el.type === 'sticky');
    expect(stickies).toHaveLength(25);
    expect(new Set(stickies.map((el) => el.fillColor)).size).toBe(4);
  });

  // The full structure pins live in template-boards.test.ts; this checks
  // the themed path (buildTemplatedTab) keeps what carries meaning.
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
});

// The OKR tree and sitemap pins live in template-hierarchies.test.ts with the
// other hierarchy starters.

// The cloud architecture, class diagram and state machine are pinned in
// template-technical.test.ts with the rest of the technical starters.

describe('design + table templates (later batch)', () => {
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
  it('keeps "Untitled canvas" for no template, and names the blank "Untitled Workshop"', () => {
    expect(untitledNameForTemplate(null)).toBe('Untitled canvas');
    expect(untitledNameForTemplate('blank-session')).toBe('Untitled Workshop');
  });
});

// Templates by mode (docs/specs/007-editor/templates-by-mode.md): the mode a card shows is the mode
// its tab opens in, and each mode's blank is of that mode.
describe('templateEditorMode', () => {
  it('is the mode every template opens in', () => {
    for (const t of TEMPLATES) {
      expect(templateEditorMode(t.kind), t.kind).toBe(
        templateCanvasOverrides(t.kind).opensIn ?? 'diagram',
      );
    }
  });

  it('gives every mode a blank of its own mode', () => {
    for (const [mode, kind] of Object.entries(BLANK_TEMPLATE_FOR_MODE)) {
      expect(templateEditorMode(kind)).toBe(mode);
    }
  });

  // A session tool shipped on a Diagram tab could be started but never watched or ended: Diagram has
  // no Session strip (docs/specs/012-collaboration/workshop-mode.md).
  it('opens every template carrying a session tool in Workshop', () => {
    for (const t of TEMPLATES) {
      if (buildTemplate(t.kind, 0, 0).some((e) => 'session' in e && e.session))
        expect(templateEditorMode(t.kind), t.kind).toBe('workshop');
    }
  });
});
