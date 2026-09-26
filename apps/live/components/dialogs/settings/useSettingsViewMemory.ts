'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applyScrollAnchor, captureScrollAnchor } from './settings-scroll-anchor';
import {
  readSettingsView,
  writeSettingsView,
  type SettingsScrollAnchor,
  type SettingsView,
} from './settings-view-memory';

// Any of these on the pane means the reader has taken over its scroll, so a
// late-growing row must no longer yank it back to the remembered anchor.
const READER_TAKEOVER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focusin'];

// The view the dialog was last closed on, read once per opening.
export function useRememberedSettingsView(): SettingsView | null {
  const [remembered] = useState(readSettingsView);
  return remembered;
}

// Keeps the Settings pane's category and scroll anchor, brings a remembered
// anchor back, and stores the view when the dialog goes away
// (docs/specs/007-editor/user-preferences.md, "It reopens where you left it").
//
// `categoryId` is the category the pane shows (null: no pane). The pane
// element must be keyed by it, so every category starts at the top.
export function useSettingsViewMemory({
  categoryId,
  restore,
}: {
  categoryId: string | null;
  restore: SettingsView | null;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const view = useRef<SettingsView>({ categoryId, anchor: null });
  // The anchor still being brought back, until the reader takes over.
  const pending = useRef<SettingsScrollAnchor | null>(restore?.anchor ?? null);
  const pendingCategoryId = useRef(restore?.categoryId ?? null);

  useLayoutEffect(() => {
    const anchor = categoryId === pendingCategoryId.current ? pending.current : null;
    view.current = { categoryId, anchor };
    const pane = paneRef.current;
    if (!pane || !anchor) return;

    if (!applyScrollAnchor(pane, anchor)) {
      pending.current = null;
      view.current = { categoryId, anchor: null };
      return;
    }
    // Rows that load after the restore (the token list) change height and
    // would push the anchored row away; follow them until the reader acts.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (pending.current) applyScrollAnchor(pane, pending.current);
          });
    observer?.observe(pane);
    if (pane.firstElementChild) observer?.observe(pane.firstElementChild);
    const release = () => {
      pending.current = null;
      observer?.disconnect();
    };
    for (const type of READER_TAKEOVER_EVENTS) {
      pane.addEventListener(type, release, { passive: true });
    }
    return () => {
      observer?.disconnect();
      for (const type of READER_TAKEOVER_EVENTS) pane.removeEventListener(type, release);
    };
  }, [categoryId]);

  // Stored on the way out, never per scroll event.
  useEffect(() => {
    const store = () => writeSettingsView(view.current);
    window.addEventListener('pagehide', store);
    return () => {
      window.removeEventListener('pagehide', store);
      store();
    };
  }, []);

  const onPaneScroll = useCallback(() => {
    const pane = paneRef.current;
    if (!pane || pending.current) return;
    view.current = { categoryId: view.current.categoryId, anchor: captureScrollAnchor(pane) };
  }, []);

  // The reader picked a category: nothing left to bring back.
  const forgetRestore = useCallback(() => {
    pending.current = null;
  }, []);

  return { paneRef, onPaneScroll, forgetRestore };
}
