// The Photo panel's History (docs/specs/031-photo/photo-pages.md "The Photo panel"): this person's
// photo edits this session, each named, newest last, at most PHOTO_HISTORY_STEPS. Each remembers the
// undo depth it left the design at, so a press on one undoes (or redoes) the design's timeline to
// there; the steps past where the timeline now is show dimmed, and the next edit drops them.

import { PHOTO_HISTORY_STEPS } from '@livedesign/photo-engine';

export type PhotoHistoryEntry = { label: string; pageId: string; depth: number };

export class PhotoHistory {
  private list: PhotoHistoryEntry[] = [];
  private readonly listeners = new Set<() => void>();

  get entries(): readonly PhotoHistoryEntry[] {
    return this.list;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** An edit made, leaving the timeline at `depth`: the steps beyond `depth - 1` are gone (undone,
   *  then replaced by this edit). */
  record(label: string, pageId: string, depth: number): void {
    const kept = this.list.filter((e) => e.depth < depth);
    this.list = [...kept, { label, pageId, depth }].slice(-PHOTO_HISTORY_STEPS);
    this.emit();
  }

  /** Whether an entry is past where the timeline now is (undone, so dimmed). */
  static undone(entry: PhotoHistoryEntry, depth: number): boolean {
    return entry.depth > depth;
  }

  /** The steps to take to land on `entry`: negative undoes, positive redoes. */
  static stepsTo(entry: PhotoHistoryEntry, depth: number): number {
    return entry.depth - depth;
  }

  /** A gesture that changed nothing: its entry goes. */
  drop(depth: number): void {
    const next = this.list.filter((e) => e.depth !== depth);
    if (next.length === this.list.length) return;
    this.list = next;
    this.emit();
  }

  clear(): void {
    this.list = [];
    this.emit();
  }
}
