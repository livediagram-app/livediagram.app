// Returning visitor (docs/specs/019-marketing/returning-visitor.md): the note the editor leaves in the
// browser for the landing page, so the hero can show a returning visitor their recent diagrams without
// the static marketing site loading Clerk or calling the api. One contract, written by apps/live and read
// by apps/marketing on the same origin.

import { EDITOR_MODES, type EditorMode } from '@livediagram/document';
import type { DocumentSummary } from './index';

// The localStorage key the note lives under. Versioned: a change to the shape takes a new key.
export const RECENT_DIAGRAMS_KEY = 'livediagram:recent-diagrams:v1';

// How many diagrams the note holds: the hero's Welcome back window draws three over two.
export const RECENT_DIAGRAMS_LIMIT = 6;

// The Cache Storage cache holding each noted diagram's snapshot SVG.
export const RECENT_THUMBS_CACHE = 'livediagram-recent-thumbs-v1';

export type RecentDiagram = {
  id: string;
  name: string;
  savedAt: number;
  // The mode it opens in (its glyph on a tile without a thumbnail); null when unknown.
  mode: EditorMode | null;
};

type RecentDiagramsNote = { v: 1; diagrams: RecentDiagram[] };

// The documents worth coming back to, newest save first: nothing empty, nothing hidden from Recent
// (docs/specs/013-workspace/hide-from-recent.md), at most RECENT_DIAGRAMS_LIMIT.
export function pickRecentDiagrams(
  documents: readonly Pick<DocumentSummary, 'id' | 'name' | 'savedAt' | 'empty' | 'opensIn'>[],
  hidden: readonly string[] = [],
): RecentDiagram[] {
  const skip = new Set(hidden);
  return documents
    .filter((d) => !d.empty && !skip.has(d.id))
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .slice(0, RECENT_DIAGRAMS_LIMIT)
    .map((d) => ({ id: d.id, name: d.name, savedAt: d.savedAt ?? 0, mode: d.opensIn ?? null }));
}

export function serializeRecentDiagrams(diagrams: readonly RecentDiagram[]): string {
  const note: RecentDiagramsNote = { v: 1, diagrams: [...diagrams] };
  return JSON.stringify(note);
}

// The note, read back. Anything malformed (another version, a hand edit, a truncated write) reads as no
// diagrams, so the landing page falls back to the overview rather than drawing a broken tile.
export function parseRecentDiagrams(raw: string | null): RecentDiagram[] {
  if (!raw) return [];
  try {
    const note = JSON.parse(raw) as Partial<RecentDiagramsNote> | null;
    if (!note || note.v !== 1 || !Array.isArray(note.diagrams)) return [];
    return note.diagrams
      .filter(
        (d): d is RecentDiagram =>
          !!d &&
          typeof d.id === 'string' &&
          d.id.length > 0 &&
          typeof d.name === 'string' &&
          typeof d.savedAt === 'number',
      )
      .slice(0, RECENT_DIAGRAMS_LIMIT)
      .map((d) => ({
        id: d.id,
        name: d.name,
        savedAt: d.savedAt,
        mode: EDITOR_MODES.includes(d.mode as EditorMode) ? d.mode : null,
      }));
  } catch {
    return [];
  }
}

// The Cache Storage key for a diagram's snapshot at one save: a same-origin path nothing serves, so it
// can only ever be answered from the cache. The save time keys it, so an edited diagram is re-fetched.
export function recentThumbPath(id: string, savedAt: number): string {
  return `/__recent-thumbs/${encodeURIComponent(id)}?v=${savedAt}`;
}

// A snapshot SVG's solid background colour: the first <rect>'s fill, since a snapshot draws a
// full-viewBox background rect before any element (docs/specs/006-document/document-snapshots.md). Lets
// a tile paint its letterbox to match the diagram. Null when absent.
export function svgBackgroundColor(svg: string): string | null {
  return /<rect[^>]*\bfill="([^"]+)"/.exec(svg)?.[1] ?? null;
}

// A snapshot SVG without its fixed width and height, so an <img> renders the vector crisp at its box's
// size instead of rasterising at the snapshot's pixel size and scaling that; the viewBox keeps its aspect.
export function scalableSnapshotSvg(svg: string): string {
  return svg.replace(/(<svg\b[^>]*?)\s+width="[^"]*"\s+height="[^"]*"/, '$1');
}

// Before first paint (inline in the landing page's <head>): marks <html data-returning> when the note
// holds a diagram, so the overview's frames stay hidden and a returning visitor never sees them flash
// before Welcome back draws. Kept tiny and dependency-free; a parse is not needed to know there is one.
export const RETURNING_BOOT_SCRIPT = `try{var r=localStorage.getItem(${JSON.stringify(
  RECENT_DIAGRAMS_KEY,
)});if(r&&r.indexOf('"id"')>-1)document.documentElement.setAttribute('data-returning','')}catch(e){}`;
