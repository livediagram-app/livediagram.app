// Client-side Yjs mirror for the Level 2 realtime path (spec/75).
//
// Owns the browser's copy of the shared Yjs doc (element content only — tab
// structure, order, names and the diagram name stay on the `diagram-meta`
// op) and bridges it to the editor's Tab[] state at two seams:
//   - commit: a local autosave syncs the committed elements into the doc; the
//     resulting incremental update is broadcast as a `ydoc` room op.
//   - remote: a peer's `ydoc` update (or the room's seed) is applied, then
//     merged into the current tabs (doc elements, local meta/order).
//
// Every peer shares ONE doc history (the room seeds joiners via `ydoc-sync`),
// which is what makes concurrent edits to different fields of the SAME element
// both survive. Undo is a per-origin Y.UndoManager so it only reverts changes
// THIS client authored, never a peer's (spec/75 decision 1).

import * as Y from 'yjs';
import type { Element, Tab } from '@livediagram/diagram';
import {
  applyDiagramUpdate,
  base64ToUpdate,
  encodeDiagramUpdate,
  mergeElements,
  newDiagramDoc,
  readTabElements,
  syncElements,
  updateToBase64,
  writeElements,
} from '@livediagram/diagram/yjs';

export class YjsMirror {
  readonly doc = newDiagramDoc();
  // A distinct origin for THIS client's writes so (a) the update listener
  // only rebroadcasts local changes, not ones we just applied from a peer,
  // and (b) the UndoManager only tracks our own edits.
  private readonly localOrigin = Symbol('yjs-mirror-local');
  readonly undo: Y.UndoManager;
  private seeded = false;
  private broadcast: ((updateB64: string) => void) | null = null;

  constructor() {
    this.undo = new Y.UndoManager(this.doc.getMap('tabs'), {
      trackedOrigins: new Set([this.localOrigin]),
    });
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Only OUR writes go on the wire; a peer's update we just applied has a
      // different (null) origin and must not echo back.
      if (origin === this.localOrigin) this.broadcast?.(updateToBase64(update));
    });
  }

  get isSeeded(): boolean {
    return this.seeded;
  }

  // Register the sender used for local `ydoc` updates (the room op send).
  onLocalUpdate(fn: (updateB64: string) => void): void {
    this.broadcast = fn;
  }

  // Adopt the room's shared doc (the `ydoc-state` reply). Applied under the
  // default origin so it is NOT rebroadcast.
  adoptSharedState(updateB64: string): void {
    applyDiagramUpdate(this.doc, base64ToUpdate(updateB64));
    this.seeded = true;
  }

  // No shared doc existed: seed the element sets from our own D1 hydrate.
  // Written under the local origin so the update listener broadcasts it and
  // the room + peers adopt it as the shared seed.
  seedFromHydrate(tabs: Tab[]): void {
    if (this.seeded) return;
    this.seeded = true;
    this.doc.transact(() => writeElements(this.doc, tabs), this.localOrigin);
  }

  // Apply a peer's live `ydoc` update (default origin -> not rebroadcast).
  applyRemote(updateB64: string): void {
    applyDiagramUpdate(this.doc, base64ToUpdate(updateB64));
  }

  // Push a local commit's elements into the doc (the update listener
  // broadcasts the delta). No-op broadcast when nothing actually changed.
  commit(tabs: Tab[]): void {
    if (!this.seeded) return; // never commit before we share the doc history
    this.doc.transact(() => syncElements(this.doc, tabs), this.localOrigin);
  }

  // Merge the doc's elements into the given tabs, keeping each tab's local
  // meta + order. The editor's projection on a remote update / seed.
  mergeInto(tabs: Tab[]): Tab[] {
    return mergeElements(this.doc, tabs);
  }

  // The doc's elements for a single tab, or null if the doc has none. Used to
  // populate a tab the diagram-meta op just added whose elements are already
  // in the doc (without touching other tabs' possibly-uncommitted state).
  elementsFor(tabId: string): Element[] | null {
    return readTabElements(this.doc, tabId);
  }

  // The doc's full state as a base64 update — the same encoding the room hands
  // a joiner. Used to seed a peer that shares this exact history.
  encodeState(): string {
    return updateToBase64(encodeDiagramUpdate(this.doc));
  }

  destroy(): void {
    this.undo.destroy();
    this.doc.destroy();
  }
}
