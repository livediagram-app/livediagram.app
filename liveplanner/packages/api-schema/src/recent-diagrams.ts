// Returning visitor (docs/specs/019-marketing/returning-visitor.md): the note the editor leaves in the
// browser for the landing page, so the hero can show a returning visitor their recent diagrams without
// the static marketing site loading the session or calling the api. One contract, written by apps/editor and read
// by apps/marketing on the same origin.

import { parseEditorMode, type EditorMode } from '@liveplanner/project';
import type { ProjectSummary } from './index';

// The localStorage key the note lives under. Versioned: a change to the shape takes a new key.
export const RECENT_DIAGRAMS_KEY = 'liveplanner:recent-diagrams:v1';

// How many diagrams the note holds: the hero's Welcome back window draws three over two.
export const RECENT_DIAGRAMS_LIMIT = 6;

// The project list's opt-in (`GET /api/projects?include=team-recent`): the newest projects of the
// teams the caller has joined, beside their personal library, so the note can hold both.
export const TEAM_RECENT_INCLUDE = 'team-recent';

// How many team projects that brings: the note's six twice over, so a few hidden from Recent (a
// preference the server does not see) still leave six to show.
export const TEAM_RECENT_LIMIT = RECENT_DIAGRAMS_LIMIT * 2;

// A team library project as the list's `teamRecent` carries it: its summary and its team's name.
export type TeamRecentProject = ProjectSummary & { teamName: string };

// The Cache Storage cache holding each noted diagram's snapshot SVG.
export const RECENT_THUMBS_CACHE = 'liveplanner-recent-thumbs-v2';

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

// The projects worth coming back to, newest save first: nothing empty, nothing hidden from Recent
// (docs/specs/013-workspace/hide-from-recent.md), at most RECENT_DIAGRAMS_LIMIT.
export function pickRecentDiagrams(
  projects: readonly (Pick<ProjectSummary, 'id' | 'name' | 'savedAt' | 'empty' | 'opensIn'> & {
    teamName?: string;
  })[],
  hidden: readonly string[] = [],
): RecentDiagram[] {
  const skip = new Set(hidden);
  return projects
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

// The snapshot SVG helpers behind the Explorer's thumbnails are liveworkspace's.
export { scalableSnapshotSvg, svgBackgroundColor } from '@liveworkspace/api-schema/snapshot-svg';
