// The mini view's window (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md "The
// window"): one Document Picture-in-Picture window a tab, held outside React so the Call dock's Pop Out opens it and
// the characters layer draws into it. Memory only: nothing here is stored, and nothing reopens it by itself.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { track } from '@/lib/telemetry';
import { followRootLook, mirrorDocumentLook } from './mini-view-styles';

/** The window's opening size (D132): a long name, the hand and the bars beside the bust, seven rows before it scrolls. */
export const MINI_VIEW_WIDTH = 320;
export const MINI_VIEW_HEIGHT = 400;
export const MINI_VIEW_TITLE = 'Mini View';

/** The part of the Document Picture-in-Picture API the mini view uses; the DOM lib in use does not declare it. */
export type DocumentPictureInPictureLike = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

type WithPip = { documentPictureInPicture?: Partial<DocumentPictureInPictureLike> };

const pipOf = (scope: unknown): DocumentPictureInPictureLike | null => {
  const api = (scope as WithPip | undefined)?.documentPictureInPicture;
  return typeof api?.requestWindow === 'function' ? (api as DocumentPictureInPictureLike) : null;
};

/** Whether this browser can open the mini view: Chrome and Edge since 116, Firefox since 151; never Safari or a phone. */
export function miniViewSupported(scope: unknown = globalThis): boolean {
  return pipOf(scope) !== null;
}

let win: Window | null = null;
let opening = false;
// Stops following the opener's theme; set while a window is open.
let unfollow: (() => void) | null = null;
const listeners = createListeners();

// The person closed the window (or the browser did): forget it, once.
function forget(): void {
  if (!win) return;
  win.removeEventListener('pagehide', forget);
  unfollow?.();
  unfollow = null;
  win = null;
  listeners.notify();
}

/** Opens the mini view from a press (the request needs its user activation); a second press while open does nothing. */
export async function openMiniView(): Promise<void> {
  const api = pipOf(globalThis);
  if (win || opening || !api) return;
  opening = true;
  try {
    const pip = await api.requestWindow({ width: MINI_VIEW_WIDTH, height: MINI_VIEW_HEIGHT });
    mirrorDocumentLook(document, pip.document);
    unfollow = followRootLook(document, pip.document);
    pip.document.title = MINI_VIEW_TITLE;
    pip.document.body.style.margin = '0';
    pip.addEventListener('pagehide', forget);
    win = pip;
    listeners.notify();
    track('Canvas', 'Used', 'SpaceMiniView');
  } catch (error) {
    console.warn('[mini-view] open refused', (error as { name?: string } | null)?.name ?? 'Error');
  } finally {
    opening = false;
  }
}

/** Closes the mini view: Popped Out, or leaving the Space. */
export function closeMiniView(): void {
  const open = win;
  if (!open) return;
  forget();
  open.close();
}

/** Pop Out's press: close when open, open when not. */
export function toggleMiniView(): void {
  if (win) closeMiniView();
  else void openMiniView();
}

/** Back to Space: a press inside the window may bring the opener's tab to the front. */
export function focusSpace(): void {
  window.focus();
}

export function miniViewWindow(): Window | null {
  return win;
}

/** Subscribe to the window opening or closing (the running call: a hidden tab's tiles). */
export function onMiniViewWindow(listener: () => void): () => void {
  return listeners.subscribe(listener);
}

const serverWindow = () => null;

/** The open window, or null: the host portals into it, Pop Out reads whether it is pressed. */
export function useMiniViewWindow(): Window | null {
  return useSyncExternalStore(listeners.subscribe, miniViewWindow, serverWindow);
}

const noSubscribe = () => () => {};
const supportedNow = () => miniViewSupported();
const supportedOnServer = () => false;

/** Whether Pop Out shows: false on the static export's server render, so hydration agrees. */
export function useMiniViewSupported(): boolean {
  return useSyncExternalStore(noSubscribe, supportedNow, supportedOnServer);
}
