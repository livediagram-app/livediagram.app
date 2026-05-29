import type { Tab } from '@livediagram/diagram';
import type { Participant } from './identity';

// What we actually persist for a diagram in the prototype. A separate
// type from `Diagram` in @livediagram/diagram so storage decisions
// (versioning, denormalised fields, timestamps) don't leak into the
// shared element model.
export type StoredDiagram = {
  id: string;
  name: string;
  tabs: Tab[];
  // unix ms — for "Last edited" displays once the Explorer lists diagrams.
  savedAt: number;
};

// Persistence boundary. Per spec 02 ("Current phase: frontend prototype")
// the prototype runs against a localStorage implementation today and
// will swap to a Workers/D1 implementation later without touching the UI.
// Anything that wants to read or write a diagram goes through this.
export interface DiagramStore {
  load(id: string): StoredDiagram | null;
  save(d: StoredDiagram): void;
  // Remove a diagram from the store. No-op if the id isn't present.
  delete(id: string): void;
  // Returns every diagram id known to this store. Used by the Explorer
  // once it lists diagrams; the localStorage impl scans key prefixes.
  listIds(): string[];
  // Load every diagram. Convenience wrapper around listIds + load that
  // the Explorer uses to render its diagram list. Filtering by
  // `savedAt` / sort order is done by the caller.
  loadAll(): StoredDiagram[];
}

// Identity persistence lives next to diagram persistence because both
// hide localStorage behind a tiny module boundary. The "self" key is
// global to the device — not per-diagram — so a user keeps the same
// name + colour across every diagram in their browser. Once auth lands
// this is replaced by the signed-in user, but the guest flow still
// uses this so guests have a stable identity in their comments.
const PARTICIPANT_KEY = 'livediagram:v1:self';

export function loadSelfParticipant(): Participant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PARTICIPANT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Participant;
  } catch {
    return null;
  }
}

export function saveSelfParticipant(p: Participant): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(p));
  } catch {
    // Same fail-soft policy as the diagram store.
  }
}

const KEY_PREFIX = 'livediagram:v1:diagram:';

export const localStorageStore: DiagramStore = {
  load(id: string) {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(KEY_PREFIX + id);
      if (!raw) return null;
      return JSON.parse(raw) as StoredDiagram;
    } catch {
      return null;
    }
  },
  save(d: StoredDiagram) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY_PREFIX + d.id, JSON.stringify(d));
    } catch {
      // Quota errors, JSON failures, or denied storage — swallow so we
      // never crash the editor on a save. The Explorer is the right
      // place to surface persistence problems later.
    }
  },
  delete(id: string) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(KEY_PREFIX + id);
    } catch {
      // ignore — same fail-soft policy as load/save.
    }
  },
  listIds() {
    if (typeof window === 'undefined') return [];
    const ids: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        ids.push(key.slice(KEY_PREFIX.length));
      }
    }
    return ids;
  },
  loadAll() {
    return this.listIds()
      .map((id) => this.load(id))
      .filter((d): d is StoredDiagram => d !== null);
  },
};
