// The wire shapes of an agent's Pages edits (docs/specs/024-agents/pages-for-agents.md):
// the page changes `POST /api/documents/:id/tabs/:tabId/pages` takes,
// and what it answers. Shared by the api route, the engine (@livedesign/edit-operations), the
// verbs (CLI and MCP) and the views.
import type {
  PageKind,
  PageOrientation,
  PagePattern,
  PageSizeId,
  WireframeDeviceId,
  WireframeFrameLook,
} from '@livedesign/document';

// A wireframe page's device fields (docs/specs/007-editor/wireframe-pages.md): all on add; on set
// its frame look and system bars alone, its device being its own for good.
type WireframeFields = {
  device?: WireframeDeviceId;
  frameLook?: WireframeFrameLook;
  systemBars?: boolean;
};

// The most page changes one call takes (as change_items and change_sheet).
export const PAGE_CHANGES_MAX = 50;

// The longest page ref or layout id taken.
export const PAGES_REF_MAX = 64;

// A page named by its id, its 1-based place in the row, or its name.
export type PageRef = string | number;

export type PageBackgroundInput = {
  // A solid fill, a hex colour.
  color?: string;
  // A two-stop gradient, hex colours from and to.
  gradient?: [string, string];
  // The gradient's angle in degrees; absent is the page panel's.
  angle?: number;
  pattern?: PagePattern | 'none';
  // Back to the plain paper.
  paper?: true;
};

export type PageChange =
  | ({
      op: 'add';
      kind: PageKind;
      size?: PageSizeId;
      orientation?: PageOrientation;
      name?: string;
      background?: PageBackgroundInput;
      layout?: string;
      // The 1-based place it goes to; absent is the end.
      at?: number;
    } & WireframeFields)
  | ({
      op: 'set';
      page: PageRef;
      name?: string;
      size?: PageSizeId;
      orientation?: PageOrientation;
      background?: PageBackgroundInput;
      locked?: boolean;
    } & Omit<WireframeFields, 'device'>)
  | { op: 'layout'; page: PageRef; layout: string }
  | { op: 'move'; page: PageRef; to: number }
  | { op: 'duplicate'; page: PageRef }
  | { op: 'delete'; page: PageRef }
  // Every other page of the page's kind takes its background, as the Background tab's Apply to All.
  | { op: 'apply_background_to_all'; page: PageRef };

type PageChangeOp = PageChange['op'];
export const PAGE_CHANGE_OPS: readonly PageChangeOp[] = [
  'add',
  'set',
  'layout',
  'move',
  'duplicate',
  'delete',
  'apply_background_to_all',
];

export type PagesRequest = { pages: PageChange[] };

export type PageRect = { x: number; y: number; width: number; height: number };

export type PageSummary = {
  place: number;
  id: string;
  name: string | null;
  kind: PageKind;
  size: PageSizeId;
  orientation: PageOrientation | null;
  rect: PageRect;
  background: string | null;
  locked: boolean;
  // How many elements are on it.
  elements: number;
  // A wireframe page's device, frame look and system bars, and its screen's safe area on the canvas
  // (where its content goes); absent on any other page.
  device?: WireframeDeviceId;
  frameLook?: WireframeFrameLook;
  systemBars?: boolean;
  screen?: PageRect;
};

export type PagesAnswer = {
  tab: { id: string; rev: number };
  switched: boolean;
  lines: string[];
  pages: PageSummary[];
  changesetId: string | null;
};

const PAGES_REFUSAL_CODES = [
  'invalid_body',
  'invalid_value',
  'tab_locked',
  'page_unknown',
  'size_not_offered',
  'no_orientation',
  'pattern_not_offered',
  'not_a_wireframe',
  'no_other_pages',
  'layout_unknown',
  'page_locked',
  'page_limit',
  'last_page',
] as const;

export type PagesRefusalCode = (typeof PAGES_REFUSAL_CODES)[number];

// A refusal: its code, what to do about it, and the 0-based index of the page change it stopped at.
export type PagesRefusal = { code: PagesRefusalCode; message: string; change?: number };
