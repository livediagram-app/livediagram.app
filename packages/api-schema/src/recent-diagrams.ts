// Returning visitor (docs/specs/019-marketing/returning-visitor.md): the note the editor leaves in the
// browser for the landing page, so the hero can show a returning visitor their recent diagrams without
// the static marketing site loading Clerk or calling the api. One contract, written by apps/live and read
// by apps/marketing on the same origin.

import { parseEditorMode, type EditorMode } from '@liveplanner/document';
import type { DocumentSummary } from './index';

// The localStorage key the note lives under. Versioned: a change to the shape takes a new key.
export const RECENT_DIAGRAMS_KEY = 'liveplanner:recent-diagrams:v1';

// How many diagrams the note holds: the hero's Welcome back window draws three over two.
export const RECENT_DIAGRAMS_LIMIT = 6;

// The document list's opt-in (`GET /api/documents?include=team-recent`): the newest documents of the
// teams the caller has joined, beside their personal library, so the note can hold both.
export const TEAM_RECENT_INCLUDE = 'team-recent';

// How many team documents that brings: the note's six twice over, so a few hidden from Recent (a
// preference the server does not see) still leave six to show.
export const TEAM_RECENT_LIMIT = RECENT_DIAGRAMS_LIMIT * 2;

// A team library document as the list's `teamRecent` carries it: its summary and its team's name.
export type TeamRecentDocument = DocumentSummary & { teamName: string };

// The Cache Storage cache holding each noted diagram's snapshot SVG.
export const RECENT_THUMBS_CACHE = 'liveplanner-recent-thumbs-v2';
// The cache before v2, when a document in This Browser was cached as having no preview: dropped by the editor's
// sync, so every browser draws those previews once (docs/specs/019-marketing/returning-visitor.md).
export const RECENT_THUMBS_CACHE_LEGACY = 'liveplanner-recent-thumbs-v1';

export type RecentDiagram = {
  id: string;
  name: string;
  savedAt: number;
  // The mode it opens in (its glyph on a tile without a thumbnail); null when unknown.
  mode: EditorMode | null;
  // The team whose library holds it, for the tile's team mark; null for your own.
  teamName: string | null;
};

type RecentDiagramsNote = { v: 1; diagrams: RecentDiagram[] };

// The documents worth coming back to, newest save first: nothing empty, nothing hidden from Recent
// (docs/specs/013-workspace/hide-from-recent.md), at most RECENT_DIAGRAMS_LIMIT.
export function pickRecentDiagrams(
  documents: readonly (Pick<DocumentSummary, 'id' | 'name' | 'savedAt' | 'empty' | 'opensIn'> & {
    teamName?: string;
  })[],
  hidden: readonly string[] = [],
): RecentDiagram[] {
  const skip = new Set(hidden);
  return documents
    .filter((d) => !d.empty && !skip.has(d.id))
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .slice(0, RECENT_DIAGRAMS_LIMIT)
    .map((d) => ({
      id: d.id,
      name: d.name,
      savedAt: d.savedAt ?? 0,
      mode: d.opensIn ?? null,
      teamName: d.teamName ?? null,
    }));
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
        // A note written before Plan was the only mode keeps a retired id (`draw`): read as Plan.
        mode: parseEditorMode(d.mode) ?? null,
        // A note written before teams joined it has none: your own.
        teamName: typeof d.teamName === 'string' && d.teamName.length > 0 ? d.teamName : null,
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
// a tile paint its letterbox to match the diagram. Null when absent. The tag is cut out by index
// first, so the pattern only ever reads that one tag: linear, however the markup is shaped.
export function svgBackgroundColor(svg: string): string | null {
  const tag = openingTag(svg, '<rect');
  return tag ? (/\sfill="([^"]+)"/.exec(tag)?.[1] ?? null) : null;
}

// A snapshot SVG without its fixed width and height, so an <img> renders the vector crisp at its box's
// size instead of rasterising at the snapshot's pixel size and scaling that; the viewBox keeps its aspect.
export function scalableSnapshotSvg(svg: string): string {
  const tag = openingTag(svg, '<svg');
  if (!tag) return svg;
  const start = svg.indexOf(tag);
  const scalable = tag.replace(/ width="[^"]*"/, '').replace(/ height="[^"]*"/, '');
  return svg.slice(0, start) + scalable + svg.slice(start + tag.length);
}

// The first `<name ...>` opening tag in the markup (up to, not including, its `>`), or null.
function openingTag(svg: string, open: string): string | null {
  const start = svg.indexOf(open);
  if (start < 0) return null;
  const end = svg.indexOf('>', start);
  return svg.slice(start, end < 0 ? svg.length : end);
}

// How many recent diagrams the landing hero needs before its fan shows them in place of templates
// (docs/specs/019-marketing/returning-visitor.md).
export const RECENT_FAN_MIN = 3;
