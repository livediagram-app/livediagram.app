// A file made beside an item (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it", Work
// Tracker 1281): the offers a template may make, read by the editors (to show Make a plan beside it) and by the index
// (to make the file), so both always agree; and the request's reader. The index makes only these.
import { isLevel, TITLE_MAX, type App, type Level } from './constants';

export const BESIDE_OFFER_IDS = ['plan'] as const;
export type BesideOfferId = (typeof BESIDE_OFFER_IDS)[number];

export type BesideOffer = {
  id: BesideOfferId;
  // The app the file is made in, and its template (the kind its `/new?template=` takes).
  app: App;
  template: string;
  // The new file's name follows the host's: "<host> Plan".
  name: string;
  // In words: "Make a plan beside it", "New liveplanner Project Planner".
  noun: string;
  templateTitle: string;
};

export const BESIDE_OFFERS: Readonly<Record<BesideOfferId, BesideOffer>> = {
  plan: {
    id: 'plan',
    app: 'liveplanner',
    template: 'project-planner',
    name: 'Plan',
    noun: 'plan',
    templateTitle: 'Project Planner',
  },
};

export const isBesideOfferId = (value: unknown): value is BesideOfferId =>
  typeof value === 'string' && (BESIDE_OFFER_IDS as readonly string[]).includes(value);

/** The new file's name: "<host> <offer name>", the host's part cut so the whole stays within a title's length. */
export function besideTitle(host: string, offer: BesideOffer): string {
  const tail = ` ${offer.name}`;
  const head = host
    .trim()
    .slice(0, TITLE_MAX - tail.length)
    .trimEnd();
  return head ? `${head}${tail}` : offer.name;
}

// `POST /items/:id/beside` (the host's id), with the person's token and the host's grant.
export type BesideInput = {
  offer: BesideOfferId;
  // The host tab that will hold the new file's connected tab: a new tab's id.
  tabId: string;
  // The pass's role; the offer's app's default when left out.
  level?: Level;
  // Add a connected tab back to the host in the new file too.
  both?: boolean;
};

// An item or tab id as the index takes them (connections.ts's reader).
const TAB_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function readBesideInput(value: unknown): BesideInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isBesideOfferId(v.offer) || typeof v.tabId !== 'string' || !TAB_ID.test(v.tabId))
    return null;
  if (v.level !== undefined && !isLevel(v.level)) return null;
  if (v.both !== undefined && typeof v.both !== 'boolean') return null;
  return {
    offer: v.offer,
    tabId: v.tabId,
    ...(v.level === undefined ? {} : { level: v.level }),
    ...(v.both === undefined ? {} : { both: v.both }),
  };
}
