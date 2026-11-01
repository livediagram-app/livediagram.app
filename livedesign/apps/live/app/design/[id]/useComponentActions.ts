// What an Editor does with components (docs/specs/009-elements/components.md): Make Component, place an instance,
// Detach, override and reset, rename and remove a main, and the edit session's start and Done. Tab changes go
// through the editor's commit (so they undo and reach peers like any edit); library changes go through the library
// hook. Participants and Viewers get none of it (`canEdit` false): every action is a no-op for them.
import { useCallback } from 'react';
import {
  clampComponentName,
  detachInstance,
  finishComponentEdit,
  isInstance,
  makeComponent,
  makeComponentRefusal,
  nextComponentName,
  startComponentEdit,
  withOverride,
  INSTANCE_SHAPE,
  type ComponentOverride,
  type Element,
  type InstanceElement,
  type MakeComponentRefusal,
} from '@livedesign/design';
import { track } from '@/lib/telemetry';
import type { ComponentLibraryState } from './useComponentLibrary';

/** Ids `<seed>-1`, `<seed>-2`, ... afresh on each run, so a change run twice mints the same ids. */
function counter(seed: string): () => string {
  let n = 0;
  return () => `${seed}-${(n += 1)}`;
}

/** What the disabled Make Component says for each refusal (the spec's "Making a component"). */
export const MAKE_COMPONENT_REFUSAL: Record<MakeComponentRefusal, string> = {
  empty: 'Select something to make a component from',
  locked: 'Unlock the selection to make a component',
  kind: 'Images, videos, embeds, link cards and tab windows cannot go in a component',
  too_many: 'A component holds at most 200 elements',
  missing_main: 'A selected instance has no component to draw',
};

export type ComponentActions = {
  canEdit: boolean;
  /** Why Make Component may not run on these ids, or null when it may. */
  makeRefusal: (ids: ReadonlySet<string>) => MakeComponentRefusal | null;
  makeFromSelection: (ids: ReadonlySet<string>) => void;
  /** Places an instance of a main, its frame's size, centred on `at` (canvas units; absent, the view's centre). */
  placeInstance: (componentId: string, at?: { x: number; y: number }) => void;
  detach: (instanceId: string) => void;
  /** Sets one override field, or (value undefined) clears it back to the main's. */
  setOverride: (
    instanceId: string,
    elementId: string,
    field: keyof ComponentOverride,
    value: string | undefined,
  ) => void;
  resetOverrides: (instanceId: string) => void;
  rename: (componentId: string, name: string) => void;
  removeFromLibrary: (componentId: string) => void;
  startEdit: (instanceId: string) => void;
  finishEdit: (instanceId: string) => void;
};

export function useComponentActions(opts: {
  canEdit: boolean;
  selfId: string;
  elements: readonly Element[];
  commit: (map: (els: Element[]) => Element[]) => void;
  library: ComponentLibraryState;
  select: (ids: readonly string[]) => void;
  viewCentre: () => { x: number; y: number };
  newId?: () => string;
  now?: () => number;
}): ComponentActions {
  const { canEdit, selfId, elements, commit, library, select } = opts;
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const now = opts.now ?? Date.now;
  const { lookup } = library;

  const makeRefusal = useCallback(
    (ids: ReadonlySet<string>) => makeComponentRefusal(elements, ids, lookup),
    [elements, lookup],
  );

  // The editor's commit may run its change later (a state update), and more than once: each change below is pure in
  // the elements it is handed, its ids fixed up front, and what it made is read off a run on the elements as rendered.
  const makeFromSelection = (ids: ReadonlySet<string>) => {
    if (!canEdit) return;
    const componentId = newId();
    const instanceId = newId();
    const at = now();
    const make = (els: Element[]) =>
      makeComponent(els, ids, {
        componentId,
        instanceId,
        name: nextComponentName(library.library.values()),
        now: at,
        lookup,
        newId: counter(instanceId),
      });
    const result = make([...elements]);
    if (!result.ok) return;
    commit((els) => {
      const r = make(els);
      return r.ok ? r.elements : els;
    });
    void library.addComponent(result.component);
    select([instanceId]);
    track('Element', 'Added', 'Component');
  };

  const placeInstance = (componentId: string, where?: { x: number; y: number }) => {
    if (!canEdit) return;
    const main = lookup(componentId);
    if (!main) return;
    const at = where ?? opts.viewCentre();
    const instance: InstanceElement = {
      id: newId(),
      type: 'shape',
      shape: INSTANCE_SHAPE,
      componentId,
      x: at.x - main.width / 2,
      y: at.y - main.height / 2,
      width: main.width,
      height: main.height,
    };
    commit((els) => [...els, instance]);
    select([instance.id]);
    track('Element', 'Added', 'Instance');
  };

  const detach = (instanceId: string) => {
    if (!canEdit) return;
    const inst = elements.find((e) => e.id === instanceId);
    const main = isInstance(inst) ? lookup(inst.componentId) : undefined;
    if (!main) return;
    const seed = newId();
    const run = (els: Element[]) => detachInstance(els, instanceId, main, counter(seed));
    const before = new Set(elements.map((e) => e.id));
    const added = run([...elements])
      .filter((e) => !before.has(e.id))
      .map((e) => e.id);
    commit(run);
    select(added);
    track('Element', 'Changed', 'ComponentDetach');
  };

  const mapInstance = (instanceId: string, change: (el: InstanceElement) => InstanceElement) =>
    commit((els) => els.map((e) => (e.id === instanceId && isInstance(e) ? change(e) : e)));

  const setOverride = (
    instanceId: string,
    elementId: string,
    field: keyof ComponentOverride,
    value: string | undefined,
  ) => {
    if (!canEdit) return;
    mapInstance(instanceId, (e) => withOverride(e, elementId, field, value));
    track('Element', 'Changed', 'ComponentOverride');
  };

  const resetOverrides = (instanceId: string) => {
    if (!canEdit) return;
    mapInstance(instanceId, (e) => {
      const out = { ...e };
      delete out.componentOverrides;
      return out;
    });
  };

  const rename = (componentId: string, name: string) => {
    if (!canEdit) return;
    const main = lookup(componentId);
    const clamped = clampComponentName(name);
    if (!main || !clamped || clamped === main.name) return;
    library.changeComponent({ ...main, name: clamped, updatedAt: now() });
  };

  const removeFromLibrary = (componentId: string) => {
    if (!canEdit) return;
    const main = lookup(componentId);
    if (!main || main.archived) return;
    library.changeComponent({ ...main, archived: true, updatedAt: now() });
  };

  const startEdit = (instanceId: string) => {
    if (!canEdit) return;
    const inst = elements.find((e) => e.id === instanceId);
    const main = isInstance(inst) ? lookup(inst.componentId) : undefined;
    if (!main) return;
    const run = (els: Element[]) => startComponentEdit(els, instanceId, main, selfId);
    const before = new Set(elements.map((e) => e.id));
    const members = run([...elements])
      .filter((e) => !before.has(e.id))
      .map((e) => e.id);
    commit(run);
    select(members);
    track('Element', 'Changed', 'ComponentEdit');
  };

  const finishEdit = (instanceId: string) => {
    if (!canEdit) return;
    commit((els) => finishComponentEdit(els, instanceId));
    select([instanceId]);
  };

  return {
    canEdit,
    makeRefusal,
    makeFromSelection,
    placeInstance,
    detach,
    setOverride,
    resetOverrides,
    rename,
    removeFromLibrary,
    startEdit,
    finishEdit,
  };
}
