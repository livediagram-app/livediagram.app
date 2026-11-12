// What the photo wiring (usePhotoEditor.ts) hands the editor: the view's shape, the text edit in hand, and the
// tool overlay's store, kept outside React so a drag redraws only the overlay. usePhotoEditor.ts re-exports them.

import { type Photo } from '@livedesign/photo-engine';
import type { MadeSize } from '@/lib/photo-editor/make-sizes';
import type { PhotoBlobScope } from '@/lib/photo-editor/blob-client';
import { PhotoHistory } from '@/lib/photo-editor/photo-history';
import type { PixelsStore } from '@/lib/photo-editor/pixels-store';
import type { PhotoSession } from '@/lib/photo-editor/session';
import type { PhotoRuntime } from '@/lib/photo-editor/runtime';
import type { PhotoLayerPeer } from './usePhotoPresence';
import type { ToolCtx, ToolOverlay } from '@/lib/photo-editor/tools/tool-context';

/** What a tool shows over the photo, kept outside React so a drag redraws only the overlay. */
export class OverlayStore {
  private value: ToolOverlay = { kind: 'none' };
  private readonly listeners = new Set<() => void>();
  get = (): ToolOverlay => this.value;
  set = (next: ToolOverlay): void => {
    this.value = next;
    for (const fn of this.listeners) fn();
  };
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}

export type PhotoTextEdit = { layerId: string; isNew: boolean };

export type PhotoEditorView = {
  // The tab's photos by page (each page's preview), and the tab.
  photos: Readonly<Record<string, Photo>>;
  // Whether the tab has a photo page: until it does, none of the photo surfaces (or their code) load.
  hasPhotoPage: boolean;
  tabId: string;
  // The photo page in focus, and its session once its photo is in hand.
  focusId: string | null;
  session: PhotoSession | null;
  // Raised on each change the session reports: what re-renders the panel.
  version: number;
  // An Editor on an unlocked tab; a Participant may look closer (photo-pages.md "Share roles").
  canEdit: boolean;
  canInspect: boolean;
  ctx: ToolCtx | null;
  overlay: OverlayStore;
  history: PhotoHistory;
  // The design timeline's depth now, and stepping it to a History entry.
  depth: number;
  stepHistory: (steps: number) => void;
  // A press on a photo page takes it into focus.
  press: (pageId: string) => void;
  // The text overlay's edit in hand.
  textEdit: PhotoTextEdit | null;
  endTextEdit: () => void;
  scope: PhotoBlobScope | null;
  store: PixelsStore | null;
  toast: (message: string) => void;
  // Writes a photo page's photo directly (a started photo, a placed PSD): one edit.
  writePhoto: (pageId: string, photo: Photo, label: string) => void;
  // Edit as Photo: a new photo page after the image's page, started from its picture. Absent where
  // the session may not add pages.
  editAsPhoto?: (imageId: string, from: { x: number; y: number }) => void;
  // Make Sizes' pages added after the source page, one edit, and the view taken to the first; false when
  // refused (no room). Absent where the session may not add pages (photo-pages.md "Making sizes").
  addSizes?: (sourceId: string, made: readonly MadeSize[]) => boolean;
  // How many more photo pages the tab takes.
  photoRoom: number;
  // All Sizes as PNGs with their elements (Make Sizes' toast); absent without a scope.
  exportAllSizes?: (designName: string) => Promise<void>;
  // Rasterize Into Layer: an element on the photo in focus drawn into a new layer and removed, one
  // edit. Absent where the session may not edit the photo.
  rasterizeElement?: (elementId: string) => void;
  // The photo editor's working parts once they have loaded (a tab with a photo page).
  runtime: PhotoRuntime | null;
  // The peers on a layer of the photo in focus, for its row's avatars.
  others: (layerId: string) => readonly PhotoLayerPeer[];
  // Fit Photo (the page in focus fills the view) and Actual Pixels (a screen px a photo px).
  fitPhoto: () => void;
  actualPixels: () => void;
};
