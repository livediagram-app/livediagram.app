// The open design's component library (docs/specs/009-elements/components.md "The library" and "Sharing,
// collaboration and storage"): loaded once the design is, kept current by the worker's `component` ops, published to
// the export registry, and saved a short while after each change as a patch of the elements that changed, so two
// people changing different elements of one main both keep their change.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyComponentPatch,
  COMPONENT_SAVE_DEBOUNCE_MS,
  componentRefIds,
  diffComponent,
  libraryLookup,
  libraryOf,
  type ComponentLookup,
  type DesignComponent,
  type Element,
} from '@livedesign/design';
import type { ComponentRoomOp } from '@livedesign/api-schema';
import { apiLoadComponents, apiPatchComponent, apiPutComponent } from '@/lib/api/components';
import { ApiError } from '@/lib/api/core';
import { setComponentRegistry } from '@/lib/component-registry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export type ComponentLibraryState = {
  /** The design's mains by id, archived ones included. */
  library: ReadonlyMap<string, DesignComponent>;
  lookup: ComponentLookup;
  /** Whether the first load has answered (until then an instance draws as loading, not missing). */
  loaded: boolean;
  /** A main made here: shown at once, then stored. */
  addComponent: (component: DesignComponent) => Promise<void>;
  /** A main changed here (renamed, archived, edited in a session): shown at once, saved after a pause. */
  changeComponent: (next: DesignComponent) => void;
  /** Mains another clipboard or design brought along: each one the library lacks is added. */
  addMissing: (components: readonly DesignComponent[]) => void;
  /** The worker's announcement of a stored main. */
  receiveComponent: (op: ComponentRoomOp) => void;
};

/** Notes a stored version of a main; false when one as new or newer was seen already. */
export function noteStored(stamps: Map<string, number>, c: DesignComponent): boolean {
  const seen = stamps.get(c.id);
  if (seen !== undefined && c.updatedAt <= seen) return false;
  stamps.set(c.id, c.updatedAt);
  return true;
}

type Pending = {
  base: DesignComponent;
  latest: DesignComponent;
  timer: ReturnType<typeof setTimeout>;
};

export function useComponentLibrary(opts: {
  hydrated: boolean;
  designId: string | null;
  ownerId: string;
  shareCode: string | null;
  // The active tab's elements: an instance naming a main the library lacks sends for the library again.
  elements: readonly Element[];
  onSaveError: () => void;
}): ComponentLibraryState {
  const { hydrated, designId, ownerId, shareCode, elements, onSaveError } = opts;
  const [library, setLibrary] = useState<ReadonlyMap<string, DesignComponent>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [loadCount, setLoadCount] = useState(0);
  const pending = useRef(new Map<string, Pending>());
  // The newest stored version seen of each main (the worker's `updatedAt`, which only grows): two writes' ops can
  // arrive out of order, and the older one is dropped.
  const stamps = useRef(new Map<string, number>());

  const libraryRef = useLatest(library);
  const ctx = useLatest({ designId, ownerId, shareCode, onSaveError });

  useEffect(() => {
    if (!hydrated || !designId) return;
    let live = true;
    apiLoadComponents(ownerId, designId, shareCode)
      .then((list) => {
        if (!live) return;
        // A main changed here and not saved yet keeps its local copy.
        for (const c of list) noteStored(stamps.current, c);
        const next = libraryOf(list);
        for (const [id, p] of pending.current) next.set(id, p.latest);
        setLibrary(next);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        console.warn('[components] load failed', err);
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [hydrated, designId, ownerId, shareCode, loadCount]);

  // An instance naming a main the library lacks (a peer made it, or a tab came in from another design) sends for the
  // library again, at most once per id this session.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded) return;
    const unknown = componentRefIds(elements as Element[]).filter(
      (id) => !library.has(id) && !asked.current.has(id),
    );
    if (unknown.length === 0) return;
    for (const id of unknown) asked.current.add(id);
    setLoadCount((n) => n + 1);
  }, [elements, library, loaded]);

  useEffect(() => {
    setComponentRegistry(library);
  }, [library]);
  useEffect(() => () => setComponentRegistry(null), []);

  const save = useCallback(
    (id: string) => {
      const p = pending.current.get(id);
      if (!p) return;
      pending.current.delete(id);
      const patch = diffComponent(p.base, p.latest);
      if (!patch) return;
      const { designId: did, ownerId: oid, shareCode: code } = ctx.current;
      if (!did) return;
      apiPatchComponent(oid, did, id, patch, code, p.latest)
        .then((stored) => {
          noteStored(stamps.current, stored);
        })
        .catch((err: unknown) => {
          console.warn('[components] save failed', err);
          // A main gone from the library (or out of this link's reach): read the library again.
          if (err instanceof ApiError && err.status === 404) setLoadCount((n) => n + 1);
          else ctx.current.onSaveError();
        });
    },
    [ctx],
  );

  // Anything still waiting saves when the editor goes.
  useEffect(
    () => () => {
      for (const [id, p] of pending.current) {
        clearTimeout(p.timer);
        save(id);
      }
    },
    [save],
  );

  const changeComponent = useCallback(
    (next: DesignComponent) => {
      const was = pending.current.get(next.id);
      const base = was?.base ?? libraryRef.current.get(next.id) ?? next;
      if (was) clearTimeout(was.timer);
      const timer = setTimeout(() => save(next.id), COMPONENT_SAVE_DEBOUNCE_MS);
      pending.current.set(next.id, { base, latest: next, timer });
      setLibrary((prev) => new Map(prev).set(next.id, next));
    },
    [save, libraryRef],
  );

  const addComponent = useCallback(
    async (component: DesignComponent) => {
      setLibrary((prev) => new Map(prev).set(component.id, component));
      const { designId: did, ownerId: oid, shareCode: code } = ctx.current;
      if (!did) return;
      try {
        noteStored(stamps.current, await apiPutComponent(oid, did, component, code));
      } catch (err) {
        console.warn('[components] make failed', err);
        ctx.current.onSaveError();
      }
    },
    [ctx],
  );

  const addMissing = useCallback(
    (components: readonly DesignComponent[]) => {
      for (const c of components) if (!libraryRef.current.has(c.id)) void addComponent(c);
    },
    [addComponent, libraryRef],
  );

  const receiveComponent = useCallback((op: ComponentRoomOp) => {
    const stored = op.component;
    if (!noteStored(stamps.current, stored)) return;
    const p = pending.current.get(stored.id);
    let shown = stored;
    if (p) {
      // A change here not saved yet goes on top of the stored main, element by element.
      const mine = diffComponent(p.base, p.latest);
      shown = mine ? applyComponentPatch(stored, mine, p.latest.updatedAt) : stored;
      pending.current.set(stored.id, { ...p, base: stored, latest: shown });
    }
    setLibrary((prev) => new Map(prev).set(stored.id, shown));
  }, []);

  const lookup = useMemo(() => libraryLookup(library), [library]);
  return { library, lookup, loaded, addComponent, changeComponent, addMissing, receiveComponent };
}
