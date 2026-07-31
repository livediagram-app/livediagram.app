// Assembles the palette catalogue (shapes + line-art icons + technology icons
// + stickers) into the flat, keyword-tagged list the global search surfaces as
// "Add to canvas" results (spec/09). Built here, not in lib/search.ts, so the
// search matcher stays catalogue-agnostic and the Explorer (which never adds
// elements) doesn't pull the icon data into its bundle.

import type { ShapeKind } from '@livediagram/diagram';

import type { PaletteSearchItem } from '@/lib/search';
import { PALETTE_TILES, tileDisplayName } from '@/components/palette/palette-tile-defs';
import {
  getLoadedIconCatalog,
  getLoadedStickerCatalog,
  getLoadedTechIconCatalog,
} from '@/lib/icon-registry';
import { isLegacyEmojiIconId } from '@livediagram/icons';

// Search synonyms per shape: the words somebody types when they don't know
// what we called it ("database" for the cylinder, "swimlane" for the lane).
// Only the extra vocabulary lives here — the NAME and the description come
// from the shared tile catalogue, so a new element type shows up in search the
// moment its tile exists, with or without an entry below.
//
// This used to be a hand-written list of the shapes themselves, and it had
// silently fallen 22 kinds behind the palette: every Devices, Data, Media and
// Behaviour element was unfindable from the search panel.
const SHAPE_KEYWORDS: Partial<Record<ShapeKind, string>> = {
  square: 'square box rect node',
  circle: 'oval ellipse round node',
  diamond: 'decision rhombus flowchart',
  cylinder: 'database storage db disk',
  parallelogram: 'input output io flowchart',
  hexagon: 'preparation milestone',
  document: 'page report file',
  stadium: 'pill terminator start end rounded',
  cloud: 'internet network external',
  triangle: 'warning delta',
  trapezoid: 'manual operation',
  star: 'favourite highlight rating',
  'speech-bubble': 'comment callout chat note',
  frame: 'section container group region',
  page: 'document doc write article heading',
  'mind-node': 'mind map brainstorm branch idea tree',
  lane: 'swimlane band row track process',
  entity: 'record table uml class er schema field',
  'mode-button': 'mode switch button press avatar',
  portal: 'teleport jump link warp travel',
  'session-button': 'timer vote poll session start',
  reveal: 'hide cover spoiler blur uncover',
  picker: 'random pick spinner wheel choose',
  chair: 'seat sit stool furniture',
  estimate: 'points sizing poker fist estimate vote',
  temperature: 'mood check pulse gauge feeling',
  'idea-box': 'suggestions ideas inbox submit',
  agenda: 'plan schedule topics running order',
  decision: 'decided outcome record resolution',
  'roll-call': 'attendance present who register',
  actor: 'person stick figure user role uml',
  browser: 'web page window chrome site',
  monitor: 'screen desktop display computer',
  laptop: 'macbook notebook computer',
  phone: 'mobile iphone android handset',
  tablet: 'ipad slate',
  smartwatch: 'watch wearable wrist',
  'progress-bar': 'bar meter percent loading completion',
  'progress-ring': 'donut ring percent gauge dial',
  'timeline-rail': 'timeline roadmap milestones track',
  rating: 'stars score review out of five',
  'pie-chart': 'donut share split proportion chart',
  'bar-chart': 'column histogram chart graph',
  'line-chart': 'trend series graph chart plot',
  'code-block': 'code snippet syntax monospace program',
  checklist: 'todo tasks tick checkbox list',
};

// The shape-placing tiles, in palette order. Derived from the shared
// catalogue (spec/78) rather than restated, which is what keeps search from
// drifting behind the palette again. Icon / sticker / tech tiles are excluded
// deliberately: those catalogues are enumerated in full below, so including
// their single "open the picker" tile would add a duplicate result.
const SHAPE_TILES = PALETTE_TILES.filter(
  (t) => t.action.type === 'shape' && t.action.kind !== 'icon' && t.action.kind !== 'sticker',
);

// A function, not a module-load constant: the icon catalogues load as an
// async chunk (lib/icon-registry.ts), so the list must be rebuilt once they
// land. The shape entries are always present; icon / tech entries appear as
// soon as the chunk does. The caller (EditorSearchPanel) subscribes via
// useIconCatalogs, so it re-renders — and rebuilds this list — on load; the
// build is a few hundred tiny objects, cheap enough to run per open-panel
// render without memoisation.
export function buildPaletteSearchItems(): PaletteSearchItem[] {
  return [
    ...SHAPE_TILES.map((tile) => {
      const kind = (tile.action as { type: 'shape'; kind: ShapeKind }).kind;
      return {
        id: `shape:${kind}`,
        name: tileDisplayName(tile),
        // The tile's own description joins the keywords, so the sentence the
        // palette already writes about an element ("a titled band that carries
        // its contents") is searchable without being written twice.
        keywords: `shape ${SHAPE_KEYWORDS[kind] ?? ''} ${tile.description}`,
        add: { type: 'shape' as const, shapeKind: kind },
      };
    }),
    // Line art only. The catalogue still carries the legacy emoji entries so
    // pre-spec/116 elements keep rendering, but offering them here would add
    // a second way to place something that is a sticker now.
    ...getLoadedIconCatalog()
      .filter((i) => !isLegacyEmojiIconId(i.id))
      .map((i) => ({
        id: `icon:${i.id}`,
        name: i.label,
        keywords: `icon ${i.keywords}`,
        add: { type: 'icon' as const, iconId: i.id },
      })),
    // Stickers (spec/116), added through their own path. A badge also
    // matches on the word on its pill, so "blocked" finds BLOCKED.
    ...getLoadedStickerCatalog().map((s) => ({
      id: `sticker:${s.id}`,
      name: s.label,
      keywords: `sticker ${s.kind === 'badge' ? `${s.text.toLowerCase()} badge ` : 'emoji '}${s.keywords}`,
      add: { type: 'sticker' as const, stickerId: s.id },
    })),
    ...getLoadedTechIconCatalog().map((t) => ({
      id: `tech:${t.id}`,
      name: t.label,
      keywords: `technology ${t.keywords}`,
      add: { type: 'tech' as const, iconId: t.id },
    })),
  ];
}
