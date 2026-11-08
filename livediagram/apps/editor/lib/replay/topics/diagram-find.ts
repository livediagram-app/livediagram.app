import type { Element, ShapeElement } from '@livediagram/document';
import { between, centreOf, frameOf, typedAt, type Chapter, type CursorTarget, type Topic } from '../topic';
import { boxedShape, carried, tileMoved, type Tile } from './shared';

// Find Anything (docs/specs/007-editor/watch-it-built.md "The curriculum"): the palette strip's Search
// (components/palette/ToolbarSearch.tsx) opened for real, a word typed into it, and the first result carried onto the
// canvas, then again with another word. Typing only filters the panel; the carried shape is drawn by the replay, as a
// drop of that tile makes it (a Cylinder for "database", a Diamond for "decision").

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'find-search',
    name: 'Search',
    shortName: 'Search',
    ms: 5000,
    say: 'Press Search, or the S key, and type what you need.',
    sayTouch: 'Tap Search and type what you need.',
  },
  {
    id: 'find-drop',
    name: 'Drop',
    shortName: 'Drop',
    ms: 4500,
    say: 'Drag a result onto the canvas, or click it to add it.',
    sayTouch: 'Drag a result onto the canvas, or tap it to add it.',
  },
  {
    id: 'find-again',
    name: 'Again',
    shortName: 'Again',
    ms: 7000,
    say: 'Any word works: a name, a use, a kind of thing.',
    sayTouch: 'Any word works: a name, a use, a kind of thing.',
  },
];

export const SEARCH = { press: 1200, type: [1900, 3600] } as const;
export const DROP = { drag: [700, 2600] } as const;
export const AGAIN = { clear: 900, type: [1300, 3000], drag: [3900, 5800] } as const;

export const FIND_IDS = { db: 'wib-find-db', decision: 'wib-find-decision' } as const;
const WORDS = { first: 'database', second: 'decision' } as const;

const PANEL = '[data-toolbar-search]';
const QUERY = `${PANEL} input`;
const SEARCH_BUTTON: CursorTarget = { kind: 'find', selector: '[data-toolbar-search-button]' };
// A result tile by its caption (PaletteTileGrid.tsx's IconButton): the flowchart shape the word names.
const result = (caption: string): CursorTarget => ({
  kind: 'find',
  selector: `${PANEL} button`,
  text: caption,
});
const CYLINDER = result('Database');
const DIAMOND = result('Decision');

export type FindLayout = {
  readonly db: ShapeElement;
  readonly decision: ShapeElement;
  // Where each result tile was on the canvas, read until its carry starts.
  readonly dbTile: Tile;
  readonly decisionTile: Tile;
};

export const find: Topic<FindLayout> = {
  id: 'diagram-find',
  chapters: CHAPTERS,

  layout({ centre, size, tab }) {
    const narrow = size.width < 700;
    const y = centre.y - (narrow ? 160 : 200);
    const dx = narrow ? 90 : 150;
    const db = boxedShape(tab, FIND_IDS.db, 'Orders', 120, 90, centre.x - dx, y, 'cylinder');
    const decision = boxedShape(tab, FIND_IDS.decision, 'In stock?', 150, 100, centre.x + dx, y - 5, 'diamond');
    return { db, decision, dbTile: null, decisionTile: null };
  },

  measure(layout, index, ms, screen) {
    if (index <= 1 && !(index === 1 && ms >= DROP.drag[0])) {
      const tile = tileMoved(screen, CYLINDER, layout.dbTile);
      return tile ? { ...layout, dbTile: tile } : null;
    }
    if (index === 2 && ms < AGAIN.drag[0]) {
      const tile = tileMoved(screen, DIAMOND, layout.decisionTile);
      return tile ? { ...layout, decisionTile: tile } : null;
    }
    return null;
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    const { db, decision, dbTile, decisionTile } = layout;
    if (id === 'find-search') {
      if (ms < SEARCH.press) return frameOf([]);
      return frameOf([], {
        open: ['search'],
        typed: { selector: QUERY, text: typedAt(WORDS.first, ms, ...SEARCH.type) },
      });
    }
    if (id === 'find-drop') {
      const p = between(ms, DROP.drag[0], DROP.drag[1]);
      const els: Element[] = ms >= DROP.drag[0] ? [carried(db, dbTile, p)] : [];
      const carrying = !!dbTile && ms >= DROP.drag[0] && ms < DROP.drag[1];
      return frameOf(els, {
        open: ms < DROP.drag[0] + 200 ? ['search'] : [],
        typed: ms < DROP.drag[0] + 200 ? { selector: QUERY, text: WORDS.first } : null,
        hold: carrying ? centreOf(els[0] as ShapeElement) : null,
      });
    }
    // Again: Search reopened, the new word typed, the Diamond carried beside the Cylinder.
    const searching = ms >= AGAIN.clear && ms < AGAIN.drag[0] + 200;
    const p = between(ms, AGAIN.drag[0], AGAIN.drag[1]);
    const els: Element[] = [db];
    if (ms >= AGAIN.drag[0]) els.push(carried(decision, decisionTile, p));
    const carrying = !!decisionTile && ms >= AGAIN.drag[0] && ms < AGAIN.drag[1];
    return frameOf(els, {
      open: searching ? ['search'] : [],
      typed: searching ? { selector: QUERY, text: typedAt(WORDS.second, ms, ...AGAIN.type) } : null,
      hold: carrying ? centreOf(els[1] as ShapeElement) : null,
    });
  },

  plan(index) {
    const id = CHAPTERS[index]?.id ?? 'find-search';
    if (id === 'find-drop') {
      return [
        { at: DROP.drag[0], to: CYLINDER, press: true },
        { at: DROP.drag[1], to: { kind: 'element', id: FIND_IDS.db } },
      ];
    }
    if (id === 'find-again') {
      return [
        { at: AGAIN.clear, to: SEARCH_BUTTON, press: true },
        { at: AGAIN.drag[0], to: DIAMOND, press: true },
        { at: AGAIN.drag[1], to: { kind: 'element', id: FIND_IDS.decision } },
      ];
    }
    return [{ at: SEARCH.press, to: SEARCH_BUTTON, press: true }];
  },
};

