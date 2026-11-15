'use client';

// The mini view's host (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md "The
// host"): mounted once by the characters layer, it draws the mini view into the Picture-in-Picture window while one is
// open, and closes it when the Space goes (the document closes). With no window it does nothing. The people are
// worked out from the coarse copy behind a by-value key, so a tick that only moved someone renders nothing.
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { callSelf, onCallSelf } from '@/lib/calls/calls-store';
import {
  keyedMiniPeople,
  type MiniPeopleInput,
  type MiniSelf,
} from '@/lib/mini-view/mini-view-people';
import { closeMiniView, useMiniViewWindow } from '@/lib/mini-view/mini-view-window';
import { MiniView } from './MiniView';

const heardNow = () => callSelf().heard;

function MiniViewHostView({
  rows,
  self,
  tabId,
  doNotDisturb,
}: {
  rows: MiniPeopleInput['rows'];
  self: MiniSelf;
  tabId: string;
  doNotDisturb: boolean;
}) {
  const win = useMiniViewWindow();
  // Leaving the Space (the document closes) closes the window with it.
  useEffect(() => closeMiniView, []);
  if (!win) return null;
  return (
    <OpenMiniView win={win} rows={rows} self={self} tabId={tabId} doNotDisturb={doNotDisturb} />
  );
}

function OpenMiniView({
  win,
  rows,
  self,
  tabId,
  doNotDisturb,
}: {
  win: Window;
  rows: MiniPeopleInput['rows'];
  self: MiniSelf;
  tabId: string;
  doNotDisturb: boolean;
}) {
  // Who you hear: the call keeps one set until it changes, so this re-renders only then.
  const heard = useSyncExternalStore(onCallSelf, heardNow, heardNow);
  // Keyed by value: the rows' array changes on every coarse tick, the facts the window shows rarely.
  const [peopleOf] = useState(keyedMiniPeople);
  const people = peopleOf({ self, rows, heard });
  // A React root of its own in the window, not a portal: a portal's events travel the React tree, so a press in the
  // window reached the canvas's capture handlers above the characters layer and walked your character to where it
  // landed (blueprint: space-mini-view.md "The host").
  const root = useRef<Root | null>(null);
  useEffect(() => {
    const next = createRoot(win.document.body);
    root.current = next;
    return () => {
      root.current = null;
      // Unmounted after this commit: a root may not be unmounted while React is still rendering.
      queueMicrotask(() => next.unmount());
    };
  }, [win]);
  // Declared after the root's effect, so a new window's root exists by the time this draws into it.
  useEffect(() => {
    root.current?.render(
      <MiniView
        count={people.count}
        groups={people.groups}
        tabId={tabId}
        doNotDisturb={doNotDisturb}
      />,
    );
  }, [win, people.count, people.groups, tabId, doNotDisturb]);
  return null;
}

export const MiniViewHost = memo(MiniViewHostView);
