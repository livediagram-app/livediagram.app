'use client';

// The mini view's host (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md "The
// host"): mounted once by the characters layer, it draws the mini view into the Picture-in-Picture window while one is
// open, and closes it when the Space goes (the document closes). With no window it does nothing. The people are
// worked out from the coarse copy behind a by-value key, so a tick that only moved someone renders nothing.
import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
  return createPortal(
    <MiniView
      count={people.count}
      groups={people.groups}
      tabId={tabId}
      doNotDisturb={doNotDisturb}
    />,
    win.document.body,
  );
}

export const MiniViewHost = memo(MiniViewHostView);
