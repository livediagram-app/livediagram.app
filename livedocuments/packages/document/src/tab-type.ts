// The Tab type (docs/specs/006-document/document-structure.md): one tab's elements, pages, articles,
// look and settings. Re-exported from the package root (./index). Type-only imports, so nothing here
// exists at runtime.
import type { TagColour } from './tag-colours';
import type { Page, PageArrangement, PageOrientation } from './page';
import type { ArticleFlow } from './article-flow';
import type { Layer } from './layers';
import type { Finish } from './finish';
import type { TabId, TextSize } from '@liveworkspace/model-core/basics';
import type { BackgroundPattern } from './retired-patterns';
import type { Element } from './element-union';

export type Tab = {
  id: TabId;
  name: string;
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "The pages"): the A4 sheets,
  // in row order, each portrait or landscape, that everyone lays the tab out on. Absent = one page
  // (read via `pagesOf`).
  pages?: Page[];
  // The writing of the tab's article pages, by flow id (docs/specs/007-editor/article-pages.md):
  // each document's blocks and style, shared by its pages (`Page.flow`). Read via
  // `articlesOf`; synced block by block (the `article` room op), never in a `tab-meta` patch.
  articles?: Record<string, ArticleFlow>;
  // Legacy: a single page's orientation, from before multiple pages. Read as one page when `pages`
  // is absent; dropped the first time the pages change (`withPages`).
  pageOrientation?: PageOrientation;
  // How the tab's pages stand (docs/specs/007-editor/pages-mode.md "Stacked or side by side"): `stack`, one page in
  // front and the rest fanned behind it, or `row`, side by side. Absent, its kind's own (flashcards and infographic
  // pages stack, slides and articles stand in a row): read via `tabStacksPages`.
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
