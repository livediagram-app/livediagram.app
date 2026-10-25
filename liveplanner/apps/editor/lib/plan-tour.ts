import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// The Plan tour's pure parts (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md): its relaunch
// signal, its tracks, and the leftover record an older tour wrote, so a later visit tidies the example content
// a reload cut short (usePlanTourLeftovers).

// Settings → Plan tour: the Tours › "Boards Tour" or "Sheets Tour" row, turned on from off and closed, reruns the tour. A
// window event keeps the dialog decoupled from PlanTourHost, as the welcome tour's relaunch does.
export const PLAN_TOUR_RELAUNCH_EVENT = 'liveplanner:plan-tour-relaunch';

export function requestPlanTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLAN_TOUR_RELAUNCH_EVENT));
}

// The Plan tour's tracks: boards and sheets (PlanTourHost, the half picked on its welcome card), and dashboards (the
// dashboard's own tour, offered on a dashboard, DashboardTour.tsx).
export const PLAN_TOUR_TRACKS = ['boards', 'sheets', 'dashboards'] as const;
export type PlanTourTrack = (typeof PLAN_TOUR_TRACKS)[number];
// The tracks PlanTourHost runs, on a board or a sheet (the dashboard's tour is its own).
export type BoardSheetTrack = Exclude<PlanTourTrack, 'dashboards'>;

// Each track offers itself once (docs/specs/026-plan/plan-tour.md "Where it appears"): `planTourTracks` lists the
// tracks answered; `planTourSeen` counts both only for a power user (tourTrackSeen).
export function planTrackSeen(
  prefs: UserPreferences | null | undefined,
  track: PlanTourTrack,
): boolean {
  return tourTrackSeen(prefs, prefs?.planTourTracks, prefs?.planTourSeen, track);
}

/** The preferences with `tracks` answered. */
export function markPlanTracksSeen(
  prefs: UserPreferences,
  tracks: readonly PlanTourTrack[],
): UserPreferences {
  return { ...prefs, planTourTracks: withTracksAnswered(prefs.planTourTracks, tracks) };
}

// What the tour made, kept until it is taken away: the element it placed (the example board or sheet), the
// example sheet's sheet, and the example cards.
type PlanTourContent = {
  projectId: string;
  elementId: string;
  sheetId?: string;
  itemIds: string[];
};

export const PLAN_TOUR_CONTENT_KEY = 'liveplanner:v2:plan-tour-content';

// A record written before the Sheets track named the element `boardId`; it reads as the same thing.
function asContent(value: unknown): PlanTourContent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const elementId = v['elementId'] ?? v['boardId'];
  const sheetId = v['sheetId'];
  if (
    typeof v['projectId'] !== 'string' ||
    typeof elementId !== 'string' ||
    (sheetId !== undefined && typeof sheetId !== 'string') ||
    !Array.isArray(v['itemIds']) ||
    !v['itemIds'].every((id) => typeof id === 'string')
  )
    return null;
  return {
    projectId: v['projectId'],
    elementId,
    ...(sheetId ? { sheetId } : {}),
    itemIds: v['itemIds'],
  };
}

// The leftover record: what a tour cut short (a reload, a closed window) left behind. Malformed or
// unreadable reads as none.
export function readLeftover(): PlanTourContent | null {
  const raw = readLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  if (!raw) return null;
  const content = asContent(safeJson(raw));
  if (content) return content;
  removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  return null;
}

// Storage unavailable: the in-memory record still tidies up a tour that ends normally.
export function writeLeftover(content: PlanTourContent | null): void {
  if (content) writeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY, JSON.stringify(content));
  else removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
}
