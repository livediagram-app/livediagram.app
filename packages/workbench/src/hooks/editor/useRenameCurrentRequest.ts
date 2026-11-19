'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from '../ui/useLatest';

export type RenameCurrentRequest = {
  // Above 0 while a Rename <Kind> waits for the Explorer panel's Current card to open its name field; 0 for none.
  request: number;
  // The card took it (or cannot rename): the request ends.
  onHandled: () => void;
};

/**
 * The command palette's Rename <Kind> in an editor with no header bar (liveworkspace/docs/specs/004-index/
 * one-explorer.md "Rename from the search"): each bump of `nonce` opens the Explorer panel (`openExplorer`, unless it
 * is open already) and holds a request the panel's Current card takes once, opening its name field. The request is
 * dropped when the panel closes before the card took it, so a later opening never starts a rename nobody asked for,
 * and never taken where the panel can't open (`available` false: the menu button shows exactly where it can).
 */
export function useRenameCurrentRequest({
  nonce,
  explorerOpen,
  available,
  openExplorer,
}: {
  // useEditorDialogs' rename nonce for the open item: 0 until the first request.
  nonce: number;
  explorerOpen: boolean;
  // The panel can show (not Zen, not withheld by a frame or a phone held sideways).
  available: boolean;
  // Opens the panel from its menu button.
  openExplorer: () => void;
}): RenameCurrentRequest {
  const [seen, setSeen] = useState(nonce);
  const [request, setRequest] = useState(0);
  const [wasOpen, setWasOpen] = useState(explorerOpen);
  // Each bump is honoured once, as soon as it is seen (during render, so no effect lags a frame behind).
  if (nonce !== seen) {
    setSeen(nonce);
    setRequest(available ? nonce : 0);
  }
  if (explorerOpen !== wasOpen) {
    setWasOpen(explorerOpen);
    if (!explorerOpen && request) setRequest(0);
  }
  const open = useLatest(openExplorer);
  const openedFor = useRef(0);
  useEffect(() => {
    if (!request || openedFor.current === request) return;
    openedFor.current = request;
    if (!explorerOpen) open.current();
  }, [request, explorerOpen, open]);
  const onHandled = useCallback(() => setRequest(0), []);
  return { request, onHandled };
}
