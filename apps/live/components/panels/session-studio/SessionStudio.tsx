'use client';

// The Session Studio: the tab menu's Collaborate panel (spec/39, spec/88).
//
// It replaced four stacked accordions (Timer, Stopwatch, Vote, Poll), each a
// strip of small grey buttons, with one panel: a switcher across the top that
// shows what is running at a glance, and a purpose-built pane per tool
// underneath. The panel opens on whatever is live, since the usual reason to
// come back mid-session is to drive the thing already running.

import { useState } from 'react';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import {
  STUDIO_TOOLS,
  initialStudioTool,
  studioToolStatus,
  type StudioTool,
} from './session-studio';
import { StudioSwitcher } from './studio-ui';
import { TimerPane } from './TimerPane';
import { VotePane } from './VotePane';
import { PollPane } from './PollPane';

export function SessionStudio({
  selfId,
  ...session
}: SessionToolsProps & {
  // The local participant, matched against a vote's host (spec/39).
  selfId: string;
}) {
  const state = {
    timer: session.timer,
    vote: session.vote,
    pollRunning: session.livePoll !== null,
  };
  const [tool, setTool] = useState<StudioTool>(() => initialStudioTool(state));

  return (
    <div className="flex flex-col gap-3 p-3">
      <StudioSwitcher
        tools={STUDIO_TOOLS}
        tool={tool}
        status={(t) => studioToolStatus(t, state)}
        onChange={setTool}
      />
      <div role="tabpanel" aria-label={tool} className="animate-fade-in" key={tool}>
        {tool === 'timer' ? <TimerPane {...session} /> : null}
        {tool === 'vote' ? <VotePane {...session} selfId={selfId} /> : null}
        {tool === 'poll' ? <PollPane {...session} /> : null}
      </div>
    </div>
  );
}
