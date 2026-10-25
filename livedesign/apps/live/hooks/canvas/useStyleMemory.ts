'use client';

// Style memory's state and storage (docs/specs/008-canvas/quick-style-panel.md "Style memory"): read once
// per design from this browser, written back at most every 250 ms. Never
// synced and never in the design. The logic is pure, in lib/style-memory.

import { useEffect, useRef } from 'react';
import type { Element, ThemeDefinition } from '@livedesign/design';
import {
  readLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import {
  applyStyleMemory,
  forgetStyleKinds,
  parseStyleMemory,
  recordStyleEdit,
  styleKindOf,
  styleMemoryKey,
  type StyleKindKey,
  type StyleMemory,
} from '@/lib/style-memory';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export const STYLE_MEMORY_WRITE_DEBOUNCE_MS = 250;

export type StyleMemoryApi = {
  // Record one style commit: the active tab's elements before and after it.
  recordEdit: (before: readonly Element[], after: readonly Element[]) => void;
  // Dress a user-drawn element from memory; identity when nothing applies.
  styleNewElement: <T extends Element>(el: T) => T;
  forget: (kinds: readonly StyleKindKey[]) => void;
};

export function useStyleMemory({
  designId,
  theme,
}: {
  designId: string | null;
  theme: ThemeDefinition;
}): StyleMemoryApi {
  const memoryRef = useRef<StyleMemory>({});
  const loadedFor = useRef<string | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedWrite = useRef(false);

  // Read synchronously on the first call for a design, so an element drawn in
  // the same tick as the load already sees it.
  const ensureLoaded = (): boolean => {
    if (!designId) return false;
    if (loadedFor.current !== designId) {
      const raw = readLocalStorageSafe(styleMemoryKey(designId));
      memoryRef.current = parseStyleMemory(raw);
      if (raw !== null && Object.keys(memoryRef.current).length === 0 && raw !== '{}') {
        console.warn('[style-memory] unreadable', styleMemoryKey(designId));
      }
      loadedFor.current = designId;
    }
    return true;
  };

  const flush = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    const id = loadedFor.current;
    if (!id) return;
    const json = JSON.stringify(memoryRef.current);
    writeLocalStorageSafe(styleMemoryKey(id), json);
    // The safe writer swallows quota / private-mode failures; say so once, as
    // memory then lasts only for this session.
    if (!warnedWrite.current && readLocalStorageSafe(styleMemoryKey(id)) !== json) {
      warnedWrite.current = true;
      console.warn('[style-memory] write failed', styleMemoryKey(id));
    }
  };

  const schedule = () => {
    if (pending.current) return;
    pending.current = setTimeout(flush, STYLE_MEMORY_WRITE_DEBOUNCE_MS);
  };

  // A design switch or unmount writes what is pending for the old one.
  useEffect(() => () => flush(), [designId]);

  const commit = (next: StyleMemory, log: string, detail: unknown) => {
    if (next === memoryRef.current) return;
    memoryRef.current = next;
    debugLog(`[style-memory] ${log}`, detail);
    schedule();
  };

  return {
    recordEdit: (before, after) => {
      if (!ensureLoaded()) return;
      const next = recordStyleEdit(memoryRef.current, before, after, theme);
      commit(next, 'recorded', Object.keys(next));
    },
    styleNewElement: <T extends Element>(el: T): T => {
      if (!ensureLoaded()) return el;
      const dressed = applyStyleMemory(el, memoryRef.current, theme);
      if (dressed !== el) debugLog('[style-memory] applied', styleKindOf(el));
      return dressed;
    },
    forget: (kinds) => {
      if (!ensureLoaded()) return;
      commit(forgetStyleKinds(memoryRef.current, kinds), 'forgot', kinds);
    },
  };
}
