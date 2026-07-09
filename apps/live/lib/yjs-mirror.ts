// Client-side Yjs mirror for the Level 2 realtime path (spec/75).
//
// Owns the browser's copy of the shared Yjs doc and bridges it to the
// editor's existing Tab[] state at two seams:
//   - commit: a local autosave writes the committed tabs into the doc; the
//     resulting incremental update is broadcast as a `ydoc` room op.
//   - remote: a peer's `ydoc` update (or the room's seed) is applied, then
//     projected back to Tab[] for the editor to render.
//
// Every peer shares ONE doc history (the room seeds joiners via
// `ydoc-sync`), which is what makes concurrent edits to different fields of
// the SAME element both survive — the merge Level 0's whole-element update
// can't do. Undo is a per-origin Y.UndoManager so it only reverts changes
// THIS client authored, never a peer's (spec/75 decision 1).

import * as Y from 'yjs';
import type { Tab } from '@livediagram/diagram';
import {
  applyDiagramUpdate,
  base64ToUpdate,
  encodeDiagramUpdate,
  newDiagramDoc,
  readDiagram,
  syncDiagram,
  updateToBase64,
  writeDiagram,
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
    this.undo = new Y.UndoManager([this.doc.getMap('tabs'), this.doc.getArray('tabOrder')], {
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
  // default origin so it is NOT rebroadcast. Returns the projected tabs.
  adoptSharedState(updateB64: string): Tab[] {
    applyDiagramUpdate(this.doc, base64ToUpdate(updateB64));
    this.seeded = true;
    return readDiagram(this.doc);
  }

  // No shared doc existed: seed from our own D1 hydrate. Written under the
  // local origin so the update listener broadcasts it and the room + peers
  // adopt it as the shared seed.
  seedFromHydrate(tabs: Tab[]): void {
    if (this.seeded) return;
    this.seeded = true;
    this.doc.transact(() => writeDiagram(this.doc, tabs), this.localOrigin);
  }

  // Apply a peer's live `ydoc` update; returns the projected tabs to render.
  applyRemote(updateB64: string): Tab[] {
    applyDiagramUpdate(this.doc, base64ToUpdate(updateB64));
    return readDiagram(this.doc);
  }

  // Push a local commit into the doc (the update listener broadcasts the
  // delta). No-op broadcast when nothing actually changed.
  commit(tabs: Tab[]): void {
    if (!this.seeded) return; // never commit before we share the doc history
    this.doc.transact(() => syncDiagram(this.doc, tabs), this.localOrigin);
  }

  tabs(): Tab[] {
    return readDiagram(this.doc);
  }

  // The doc's full state as a base64 update — the same encoding the room
  // hands a joiner. Used to seed a peer that shares this exact history.
  encodeState(): string {
    return updateToBase64(encodeDiagramUpdate(this.doc));
  }

  destroy(): void {
    this.undo.destroy();
    this.doc.destroy();
  }
}
