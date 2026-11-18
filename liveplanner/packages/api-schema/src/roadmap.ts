// A public roadmap on the wire (docs/specs/026-plan/public-roadmap.md; blueprint public-roadmap.md): the owner's
// managing routes and the public page's read and vote. The allowlist below is the whole of what a visitor may be sent
// about a card beyond its id and title.
import type { FormLook } from '@liveplanner/project';

/** The optional card fields a roadmap may show (Title always shows). Nothing else about a card is ever sent. */
export const ROADMAP_FIELDS = ['description', 'number', 'type', 'labels', 'start', 'due'] as const;
export type RoadmapField = (typeof ROADMAP_FIELDS)[number];

/** The fields a new roadmap shows. */
export const ROADMAP_DEFAULT_FIELDS: readonly RoadmapField[] = ['description'];

/** The fields' names, as the dialog lists them. */
export const ROADMAP_FIELD_LABELS: Readonly<Record<RoadmapField, string>> = {
  description: 'Description',
  number: 'Number',
  type: 'Card Type',
  labels: 'Labels',
  start: 'Start Date',
  due: 'Due Date',
};

export const ROADMAP_TITLE_MAX = 80;
export const ROADMAP_COLUMN_CARDS_MAX = 200;
export const ROADMAP_DESCRIPTION_MAX = 1000;
/** A roadmap link's code: `lpr_` and 16 random bytes, base64url. */
export const ROADMAP_CODE_PATTERN = /^lpr_[A-Za-z0-9_-]{22}$/;
/** A visitor's browser key (a random id the page keeps in local storage). */
export const ROADMAP_BROWSER_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** What a roadmap shows: columns by status and card types by id (each among its board's), the allowlisted fields,
 *  whether visitors may upvote, and the suggestion form's code, or null. */
export type RoadmapSettings = {
  title: string;
  columns: string[];
  types: string[];
  fields: RoadmapField[];
  voting: boolean;
  formCode: string | null;
};

/** A published roadmap as its owner sees it: its board, its code and page path, and when it went up (epoch ms). */
export type PublishedRoadmap = RoadmapSettings & {
  boardId: string;
  code: string;
  path: string;
  createdAt: number;
};

/** A board that may be published: its element id, title, tab, columns and the card types it shows. `publishable` is
 *  false for an All Cards or archive board, which has no columns to choose. */
export type RoadmapBoard = {
  id: string;
  title: string;
  tabId: string;
  tabName: string;
  // A column's own colour (a CSS colour) when it has one, for its dot in the dialog.
  columns: { status: string; name: string; color: string | null }[];
  // The card types it shows, with their glyph and colour.
  types: { id: string; name: string; glyph: string; color: string }[];
  publishable: boolean;
};

/** A form that may be a suggestion form: its code, heading and tab, and the columns (statuses) its cards land in. */
export type RoadmapForm = { code: string; heading: string; tabName: string; statuses: string[] };

/** GET /api/projects/:id/roadmaps. */
export type RoadmapsResponse = {
  roadmaps: PublishedRoadmap[];
  boards: RoadmapBoard[];
  forms: RoadmapForm[];
};

/** PUT /api/projects/:id/roadmaps/:boardId. */
export type RoadmapResponse = { roadmap: PublishedRoadmap };

/** One card on the public page: only allowlisted fields, each present only when chosen and set. */
export type PublicRoadmapCard = {
  id: string;
  title: string;
  votes?: number;
  voted?: boolean;
  description?: string;
  number?: number;
  // Its number as people see it, with its type's prefix ("WI-12": item-types.md "Card number prefixes"), beside `number`.
  ref?: string;
  type?: string;
  labels?: string[];
  start?: string;
  due?: string;
};

/** One chosen column: its name, how many cards it holds, and the first ROADMAP_COLUMN_CARDS_MAX of them. */
export type PublicRoadmapColumn = { name: string; count: number; cards: PublicRoadmapCard[] };

/** GET /api/roadmaps/:planId/:code. `suggestPath` is the suggestion form's page (`/form/<code>`), or null. */
export type PublicRoadmap = {
  title: string;
  voting: boolean;
  suggestPath: string | null;
  look: FormLook;
  columns: PublicRoadmapColumn[];
};

/** POST /api/roadmaps/:planId/:code/votes: the card's count now, and whether this browser votes for it. */
export type RoadmapVoteResponse = { votes: number; voted: boolean };

/** The refusals the routes name. */
export const ROADMAP_ERRORS = [
  'roadmap_not_found',
  'card_not_found',
  'roadmap_vote_invalid',
  'roadmap_busy',
  'roadmap_votes_full',
  'roadmap_needs_owner',
  'roadmap_invalid',
  'roadmap_suggestions_public',
] as const;
export type RoadmapError = (typeof ROADMAP_ERRORS)[number];

/** A roadmap link's page path. */
export const roadmapPath = (planId: string, code: string): string =>
  `/roadmap/${encodeURIComponent(planId)}/${code}`;
