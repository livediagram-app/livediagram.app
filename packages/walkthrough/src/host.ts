// What an app hands the walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md "One package, four apps"):
// its api, its viewport store, its canvas, its tabs and, in the two apps with decks, its slides. Each app binds this
// once in its editor; everything else is the package's.

import type { WalkthroughApiDeps } from './api';
import type { CanvasView } from './timeline';

/** The editor's viewport store (@liveworkspace/workbench's), as the walkthroughs use it. */
export type WalkthroughViewport = {
  get: () => CanvasView;
  subscribe: (listener: () => void) => () => void;
  setView: (view: CanvasView) => void;
};

export type WalkthroughSlides = {
  // The slide showing, or null outside the deck.
  current: string | null;
  // Its name, for the scrubber's mark.
  label: string | null;
  // Shows a slide, or ends the deck with null.
  show: (slide: string | null) => void;
};

export type WalkthroughHost = {
  // The open item, or null where walkthroughs don't fit (an unsaved item, This Browser, an embed, a phone, a
  // tab-scoped link): then no button shows.
  itemId: string | null;
  api: WalkthroughApiDeps;
  viewport: WalkthroughViewport;
  // The element that holds the canvas content (`data-canvas-content`), for the pointer and the press rings.
  canvasRoot: () => HTMLElement | null;
  tab: string;
  tabName: (tab: string) => string;
  // Opens a tab; false when the item no longer has it.
  showTab: (tab: string) => boolean;
  slides?: WalkthroughSlides | undefined;
  // A tab's content fingerprint (fingerprintOf), or null when the tab is gone.
  fingerprint: (tab: string) => string | null;
  // The selected elements' ids, for Hide Selection.
  selection: () => readonly string[];
  // The recorder's name as the list shows it to others.
  author: string | null;
};
