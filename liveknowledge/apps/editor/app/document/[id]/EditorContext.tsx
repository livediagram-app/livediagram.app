'use client';

import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { createEditorContext } from '@liveworkspace/workbench/hooks/editor/createEditorContext';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { useEditorState } from './useEditorState';

// Typed from the page's orchestration hook, so the value type stays in lockstep with the provider + consumers.
export const { EditorContext, useEditorContext, useOptionalEditorContext } =
  createEditorContext<ReturnType<typeof useEditorState>>();

export type EditorContextValue = ReturnType<typeof useEditorState>;

// The editor's chrome store (docs/specs/007-editor/blueprints/typing.md "Performance and limits"): the same
// view-model as EditorContext, held outside React. EditorContext hands every reader a new value on every render of
// the page, so each typing commit re-rendered every reader, the chrome that never reads the document among them. The
// chrome reads this store instead, one slice at a time (`useEditorChrome`), and renders only when its slice changed;
// its handlers read the newest value when they run (`useEditorChromeStore().get()`), never in render.
export type EditorChromeStore = {
  get: () => EditorContextValue;
  set: (value: EditorContextValue) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createEditorChromeStore(initial: EditorContextValue): EditorChromeStore {
  let value = initial;
  const listeners = createListeners();
  return {
    get: () => value,
    set: (next) => {
      if (next === value) return;
      value = next;
      listeners.notify();
    },
    subscribe: listeners.subscribe,
  };
}

export const EditorChromeContext = createContext<EditorChromeStore | null>(null);

/** The page's store, made once and given each render's view-model after it commits (a layout effect, so a reader it
 *  wakes renders before the browser paints). Readers rendered in that same commit read the value before it, so the
 *  chrome renders only when the store wakes it, never as a child of the page's render. */
export function usePublishEditorChrome(value: EditorContextValue): EditorChromeStore {
  const [store] = useState(() => createEditorChromeStore(value));
  useLayoutEffect(() => store.set(value));
  return store;
}

export function useEditorChromeStore(): EditorChromeStore {
  const store = useContext(EditorChromeContext);
  if (!store)
    throw new Error('useEditorChromeStore must be used within an EditorChromeContext.Provider');
  return store;
}

/** One slice of the editor's view-model: the reader renders only when it changed (`equal`, Object.is by default). A
 *  selector returns data, never a handler (handlers are new on every render). */
export function useEditorChrome<T>(
  select: (value: EditorContextValue) => T,
  equal?: (a: T, b: T) => boolean,
): T {
  return useStoreSlice(useEditorChromeStore(), select, equal);
}

/** A bag of handlers and data the view-model rebuilds on every render (a host's `deps`): the reader renders only when
 *  `same` says it changed, and each render reads the newest bag, so a render for any other reason (its own state, the
 *  selection) never runs on an old one.
 *
 *  Uncompiled: the React Compiler takes `store.get()` for a pure read and keeps its first result while `store` and
 *  `select` keep their identity, so the reader would see the bag from its first render forever (the Quick Style bar
 *  styled the empty tab it mounted on and never showed). */
export function useEditorChromeLatest<T>(
  select: (value: EditorContextValue) => T,
  same: (a: T, b: T) => boolean,
): T {
  'use no memo';
  const store = useEditorChromeStore();
  useStoreSlice(store, select, same);
  return select(store.get());
}
