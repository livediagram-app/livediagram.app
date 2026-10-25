'use client';

// How a workspace frame moves (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame", WB57,
// WB58, WB59): it takes every navigation the Explorer and the editor make (the app's interceptor and a capture of
// same-origin link clicks), and moves itself with the History API, which the App Router hears; the browser's own
// back and forward walk the same entries. An Explorer or design href becomes a frame path; the wizard becomes New
// design in place; anything else opens in a new tab. The frame never loads another page, so its session, held
// in memory only, lives on.
import { useCallback, useLayoutEffect, type RefObject } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { setAppNavigationInterceptor } from '@liveworkspace/workbench/lib/app-location';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  framePathOfAppHref,
  isNewDesignHref,
  workspaceFramePath,
  workspacePlaceOf,
  type WorkspacePlace,
} from '@/lib/workbench/workspace-place';
import { createDesignInPlace, createInPlaceOf } from './create-in-place';

// The history entry of a design the frame opened carries where it was opened from, so Back returns there.
type FrameEntryState = { workbenchFrom?: string };

const currentPath = (win: Window) => `${win.location.pathname}${win.location.search}`;
const isDesignPath = (path: string) => path.startsWith('/embed/workbench/design/');

export type WorkspaceNavigation = {
  // Moves the frame to a place.
  go: (place: WorkspacePlace) => void;
  // Back to where the open design was opened from, else Home.
  back: () => void;
};

export function useWorkspaceNavigation(opts: {
  rootRef: RefObject<HTMLElement | null>;
  ownerId: string;
  // The place the frame shows now, for New design's defaults.
  place: WorkspacePlace;
  onCreateFailed: () => void;
  win?: Window;
}): WorkspaceNavigation {
  const { rootRef, ownerId, onCreateFailed } = opts;
  const win = opts.win ?? window;
  const placeRef = useLatest(opts.place);

  const move = useCallback(
    (path: string, replace: boolean) => {
      const from = currentPath(win);
      if (path === from) return;
      const state: FrameEntryState =
        isDesignPath(path) && !isDesignPath(from) ? { workbenchFrom: from } : {};
      if (replace) win.history.replaceState(state, '', path);
      else win.history.pushState(state, '', path);
    },
    [win],
  );

  const createInPlace = useCallback(
    (href: string) => {
      const request = createInPlaceOf(href, win.location.origin, placeRef.current);
      void createDesignInPlace(ownerId, request).then(
        (designId) =>
          move(
            workspaceFramePath({ kind: 'design', designId, tabId: null, shareCode: null }),
            false,
          ),
        (err: unknown) => {
          console.warn('[workbench] create-failed', {
            status: (err as { status?: number } | null)?.status ?? null,
          });
          onCreateFailed();
        },
      );
    },
    [ownerId, move, onCreateFailed, win, placeRef],
  );

  // Answers true for every href: the frame holds what it can and sends the rest to a new tab.
  const navigate = useCallback(
    (href: string, replace: boolean): boolean => {
      const origin = win.location.origin;
      if (isNewDesignHref(href, origin)) {
        createInPlace(href);
        return true;
      }
      const path = framePathOfAppHref(href, origin);
      if (path !== null) {
        move(path, replace);
        return true;
      }
      debugLog('[workbench] opened outside the frame', { origin: new URL(href, origin).origin });
      win.open(new URL(href, origin).toString(), '_blank', 'noopener');
      return true;
    },
    [createInPlace, move, win],
  );

  // Before any child can navigate: the interceptor first, then the capture of link clicks. A click the person means
  // for a new tab (a modifier, a middle click, a `target`, a download) is left to the browser.
  useLayoutEffect(
    () => setAppNavigationInterceptor((href, { replace }) => navigate(href, replace)),
    [navigate],
  );
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      if (new URL(anchor.href, win.location.origin).origin !== win.location.origin) return;
      // Prevented here, in the capture phase, so neither the browser nor a Next link loads the page; the
      // anchor's own handlers still run.
      event.preventDefault();
      navigate(anchor.getAttribute('href') ?? anchor.href, false);
    };
    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }, [rootRef, navigate, win]);

  const go = useCallback((place: WorkspacePlace) => move(workspaceFramePath(place), false), [move]);

  const back = useCallback(() => {
    const from = (win.history.state as FrameEntryState | null)?.workbenchFrom;
    if (from && workspacePlaceOf(from.split('?')[0]!, new URLSearchParams()).kind === 'explorer') {
      win.history.back();
      return;
    }
    move(workspaceFramePath({ kind: 'explorer', node: { kind: 'home' } }), false);
  }, [move, win]);

  return { go, back };
}
