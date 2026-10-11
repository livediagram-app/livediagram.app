import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from './local-storage-safe';

// The Plan tour's pure parts (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md): its relaunch
// signal, its tracks, and the leftover record an older tour wrote, so a later visit tidies the example content
// a reload cut short (usePlanTourLeftovers).

// Settings → Plan tour: the Onboarding Tutorials › "Plan" row, turned on from off and closed, reruns the tour. A
// window event keeps the dialog decoupled from PlanTourHost, as the welcome tour's relaunch does.
export const PLAN_TOUR_RELAUNCH_EVENT = 'livediagram:plan-tour-relaunch';

export function requestPlanTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLAN_TOUR_RELAUNCH_EVENT));
}

// Which half of Plan the tour shows, picked on its welcome card.
export const PLAN_TOUR_TRACKS = ['boards', 'sheets'] as const;
export type PlanTourTrack = (typeof PLAN_TOUR_TRACKS)[number];

// What the tour made, kept until it is taken away: the element it placed (the example board or sheet), the
// example sheet's sheet, and the example cards.
export type PlanTourContent = {
  documentId: string;
  elementId: string;
  sheetId?: string;
  itemIds: string[];
};

export const PLAN_TOUR_CONTENT_KEY = 'livediagram:v2:plan-tour-content';

// A record written before the Sheets track named the element `boardId`; it reads as the same thing.
function asContent(value: unknown): PlanTourContent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const elementId = v['elementId'] ?? v['boardId'];
  const sheetId = v['sheetId'];
  if (
    typeof v['documentId'] !== 'string' ||
    typeof elementId !== 'string' ||
    (sheetId !== undefined && typeof sheetId !== 'string') ||
    !Array.isArray(v['itemIds']) ||
    !v['itemIds'].every((id) => typeof id === 'string')
  )
    return null;
  return {
    documentId: v['documentId'],
    elementId,
    ...(sheetId ? { sheetId } : {}),
    itemIds: v['itemIds'] as string[],
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
