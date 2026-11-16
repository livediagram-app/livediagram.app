'use client';

// The capture behind Suggesting (../capture.ts), made once per editor where its history lives: the editor's commit
// and tick go through `capture.wrap`. What decides whether this person is suggesting, and where a gathered change
// goes, is filled in later by the suggestions hook through `connect`, since it needs slices composed after the history.
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  createSuggestCapture,
  type CaptureTab,
  type SuggestCapture,
  type SuggestCaptureDeps,
} from '../capture';
import type { SuggestionElement, SuggestionOp } from '../suggestion';

export type SuggestBridge<E extends SuggestionElement> = {
  suggestingOn: () => string | null;
  propose: (tabId: string, ops: SuggestionOp<E>[]) => void;
  refuse: () => void;
};

export type SuggestCaptureHandle<T extends CaptureTab<E>, E extends SuggestionElement> = {
  capture: SuggestCapture<T, E>;
  // The suggestions hook plugs itself in (and out, with null).
  connect: (bridge: SuggestBridge<E> | null) => void;
};

type Held<T extends CaptureTab<E>, E extends SuggestionElement> = SuggestCaptureHandle<T, E> & {
  setTabs: (tabs: T[]) => void;
  setPointerDown: (down: boolean) => void;
};

export type SuggestCaptureOptions<T extends CaptureTab<E>, E extends SuggestionElement> = Pick<
  SuggestCaptureDeps<T, E>,
  'fingerprint' | 'passThrough'
>;

function makeHandle<T extends CaptureTab<E>, E extends SuggestionElement>(
  first: T[],
  options: SuggestCaptureOptions<T, E>,
): Held<T, E> {
  let tabs = first;
  let bridge: SuggestBridge<E> | null = null;
  let down = false;
  const capture = createSuggestCapture<T, E>({
    suggestingOn: () => bridge?.suggestingOn() ?? null,
    tabs: () => tabs,
    propose: (tabId, ops) => bridge?.propose(tabId, ops),
    refuse: () => bridge?.refuse(),
    pointerDown: () => down,
    ...options,
  });
  return {
    capture,
    connect: (b) => {
      bridge = b;
    },
    setTabs: (t) => {
      tabs = t;
    },
    setPointerDown: (d) => {
      down = d;
    },
  };
}

/** `fingerprint` is the product's element fingerprint without live fields: a change to those alone (a comment, a
 *  reaction) is never a suggestion. `passThrough` lets a change to the tab's own fields through (../capture.ts). */
export function useSuggestCapture<T extends CaptureTab<E>, E extends SuggestionElement>(
  tabs: T[],
  options: SuggestCaptureOptions<T, E> = {},
): SuggestCaptureHandle<T, E> {
  const [held] = useState(() => makeHandle<T, E>(tabs, options));
  useLayoutEffect(() => held.setTabs(tabs), [held, tabs]);
  // A gesture is one suggestion: what it gathered goes once its pointer lets go (after the landing tick it fires).
  useEffect(() => {
    const down = () => held.setPointerDown(true);
    const up = () => {
      held.setPointerDown(false);
      setTimeout(() => held.capture.flush(), 0);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [held]);
  return held;
}
