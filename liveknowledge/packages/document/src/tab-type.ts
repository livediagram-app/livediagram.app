// The Tab type (docs/specs/006-document/document-structure.md): one tab's elements, pages, articles,
// look and settings. Re-exported from the package root (./index). Type-only imports, so nothing here
// exists at runtime.
import type { TagColour } from './tag-colours';
import type { Page, PageArrangement, PageBackground, PageOrientation } from './page';
import type { ArticleFlow } from './article-flow';
import type { TabDraft } from './page-draft';
import type { TabCover } from './page-cover';
import type { TabIcon } from './page-icon';
import type { Layer } from './layers';
import type { Finish } from './finish';
import type { TabId, TextSize } from '@liveworkspace/model-core/basics';
import type { BackgroundPattern } from './retired-patterns';
import type { Element } from './element-union';

/** A page's knowledge fields as stored. Every one is optional: absent is no owner, never verified, not in context.
 *  When a verified page's review comes due is the knowledgebase's (`KnowledgeSettings.reviewEvery`), not the page's. */
export type TabKnowledge = {
  owner?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  context?: true;
  approval?: PageApproval;
};

/** A page's approval (docs/specs/030-knowledgebase/approval.md "The field"): asked for, then approved or rejected
 *  by someone else. Written only by the api's approval route. */
export type PageApprovalState = 'pending' | 'approved' | 'rejected';
export type PageApproval = {
  state: PageApprovalState;
  /** The account that asked: a person's, or an agent token's person. */
  requestedBy: string;
  requestedAt: number;
  /** The agent's name, when an agent asked. */
  requestedByAgent?: string;
  /** The asker's name as their profile said it then, so a reader the editor cannot name still sees who. */
  requestedByName?: string;
  decidedBy?: string;
  decidedAt?: number;
  decidedByName?: string;
  /** A rejection's note, up to 500 characters. */
  note?: string;
};

export type Tab = {
  id: TabId;
  name: string;
  // The page this page sits under in the page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
  // page tree"): a tab id of the same knowledgebase. Absent is the top level; so is a parent that no longer exists,
  // or one that would close a cycle (read via `pageParents`, page-tree.ts). Stored in the tab's body and synced in
  // a `tab-meta` patch, as its name is.
  parent?: TabId;
  // The page's knowledge fields (docs/specs/030-knowledgebase/verification.md "The fields", ai-knowledge.md "Always
  // in Context"): who vouches for it, when they last did, how often it is reviewed, and whether every agent is
  // handed it. Written only by the api's knowledge routes (Verify, the Page Health card), read through
  // `parseKnowledgeFields` (@liveknowledge/knowledge), and synced in a `tab-meta` patch, as the name is.
  knowledge?: TabKnowledge;
  // The page's cover (docs/specs/030-knowledgebase/page-surface.md "The cover"): a picture, a theme gradient or an animated background across the
  // top of the page. Settled on every read (`withSettledCover`), synced in a `tab-meta` patch, as the name is.
  cover?: TabCover;
  // The page's icon (docs/specs/030-knowledgebase/page-surface.md "The page icon"): an emoji or a line-art catalogue
  // icon, above the Title and before the page's name in the tree. Settled on every read (`withSettledIcon`), synced
  // in a `tab-meta` patch, as the cover is.
  icon?: TabIcon;
  // The labels the page carries (docs/specs/030-knowledgebase/page-surface.md "Page labels"): ids of the
  // knowledgebase's labels (`KnowledgeSettings.labels`). Settled on every read (`withSettledLabels`), synced in a
  // `tab-meta` patch, as the icon is.
  labels?: string[];
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "The pages"): the A4 sheets,
  // in row order, each portrait or landscape, that everyone lays the tab out on. Absent = one page
  // (read via `pagesOf`).
  pages?: Page[];
  // The writing of the tab's article pages, by flow id (docs/specs/007-editor/article-pages.md):
  // each document's blocks and style, shared by its pages (`Page.flow`). Read via
  // `articlesOf`; synced block by block (the `article` room op), never in a `tab-meta` patch.
  articles?: Record<string, ArticleFlow>;
  // The page's open draft's record (docs/specs/030-knowledgebase/editing.md): who last changed the draft, when, its
  // height and the saved blocks it was made from. Its writing is `articles.draft` (page-draft.ts); read via
  // `draftOf`. Synced in a `tab-meta` patch, never sent to a session that cannot edit.
  draft?: TabDraft;
  // Legacy: a single page's orientation, from before multiple pages. Read as one page when `pages`
  // is absent; dropped the first time the pages change (`withPages`).
  pageOrientation?: PageOrientation;
  // How the tab's pages stand (docs/specs/007-editor/pages-mode.md "Stacked or side by side"): `stack`, one page in
  // front and the rest fanned behind it, or `row`, side by side. Absent, side by side: read via
  // `tabStacksPages`.
  pageArrangement?: PageArrangement;
  // The colours someone picked with + in a colour picker on this tab, newest first, lower-case
  // `#rrggbb` (docs/specs/004-interface-design/colour-picker.md "Custom colours"). Read via
  // `customColoursOf`; every picker in the document offers them as Custom Colours.
  customColours?: string[];
  // Tag colours (docs/specs/009-elements/tag-colours.md): a card tag mapped to a colour, read with `tagColoursOf`.
  tagColours?: TagColour[];
  elements: Element[];
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
  // 0..1, defaults to 1. Applied to backgroundColor as the alpha
  // channel so the canvas can sit over a transparent / lower-opacity
  // backdrop (useful when embedded or layered on a theme).
  backgroundOpacity?: number;
  patternColor?: string;
  // Pattern tile scale, defaults to 1. Multiplies the rendered pattern's
  // tile size so the user can make the grid / dots / texture larger or
  // smaller (the canvas pattern-size slider). Does not affect the pan
  // phase, so the pattern still tracks panning at any scale.
  backgroundPatternScale?: number;
  // Motion speed for an ANIMATED background pattern (docs/specs/008-canvas/canvas-and-palette.md), defaults to
  // 1. A rate multiplier (2 = twice as fast) fed to the animated backdrop's
  // keyframes; ignored by the static patterns. The canvas Speed slider
  // (shown only while an animated pattern is active) writes it.
  backgroundAnimationSpeed?: number;
  // The background every new page starts on (docs/specs/007-editor/pages-mode.md "A new page's background", set in
  // Tab Style's New Page Background): a fill and a pattern, never a picture. Absent, a new page carries over the
  // page before it, and a first page takes its kind's theme default. Read via `newPageBackgroundOf`.
  newPageBackground?: PageBackground;
  // Selected preset theme name (see apps/editor/lib/themes.ts). Setting
  // a theme via the palette repaints every existing element on the tab
  // to match (sticky notes keep their amber palette). Newly added
  // elements inherit the same theme colours by default. Unset = brand
  // defaults.
  theme?: string;
  // Default font-family id for this tab (see ../packages/model-core/src/fonts.ts).
  // Every text-bearing element without its own `font` renders in this
  // one; unset = the editor default. Lets a whole tab adopt a font in
  // one move while individual elements can still override.
  font?: string;
  // Drawing style for every element without its own (docs/specs/008-canvas/finish.md); unset = Flexible.
  finish?: Finish;
  // Default text size for NEW elements added from the palette on this
  // tab. Unlike `font`, this is a create-time seed: copied onto each
  // new element's own `textSize`, not resolved at render: so changing
  // it later doesn't retroactively resize existing elements. Unset = the
  // per-type factory default ('md').
  defaultTextSize?: TextSize;
  // Set to true once the user has explicitly chosen a starting template
  // (including "Blank"), so the template picker doesn't reappear on this tab.
  templateChosen?: boolean;
  // True when the tab is locked: every element becomes read-only,
  // adds via the palette are blocked, theme / background mutations
  // are blocked for as long as this tab is active. Toggled from the
  // tab ellipsis menu.
  locked?: boolean;
  // Per-document folder name (docs/specs/006-document/tab-folders.md). Tabs sharing a name render
  // as a contiguous run under one collapsible chip in the tab bar.
  // This is link metadata, not body content: it's stripped from the
  // persisted tab body and carried on the document_tabs row alongside
  // order_index, so a shared tab can be foldered in one document and
  // loose in another. Unset / empty = loose. See tab-folders.ts for
  // the normalize + grouping helpers.
  folder?: string;
  // Photoshop-style layers (docs/specs/006-document/layers.md), ordered BOTTOM -> TOP (index 0
  // paints lowest). Absent = the tab behaves as one implicit default
  // layer; the array is materialised lazily on the first layer
  // operation (see layers.ts). Elements point in via `layerId`.
  layers?: Layer[];
};
