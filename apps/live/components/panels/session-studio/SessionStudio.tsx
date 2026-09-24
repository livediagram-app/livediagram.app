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

  const blocked = Boolean(session.facilitatedBy);
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Disabled rather than hidden (spec/147): a panel that emptied itself
          would teach a different editor to every participant, and somebody
          who had never seen the timer would not know there was one. A
          `fieldset` because it disables every control inside it natively,
          including ones added later. */}
      {blocked ? (
        <p className="rounded-md bg-slate-100 px-2.5 py-2 text-[12px] leading-snug text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-semibold">{session.facilitatedBy}</span> is facilitating this
          session. Ask them to start the timer, the vote or a poll.
        </p>
      ) : null}
      <StudioSwitcher
        tools={STUDIO_TOOLS}
        tool={tool}
        status={(t) => studioToolStatus(t, state)}
        onChange={setTool}
      />
      <fieldset
        disabled={blocked}
        role="tabpanel"
        aria-label={tool}
        className="animate-fade-in min-w-0 border-0 p-0 disabled:opacity-60"
        key={tool}
      >
        {tool === 'timer' ? <TimerPane {...session} /> : null}
        {tool === 'vote' ? <VotePane {...session} selfId={selfId} /> : null}
        {tool === 'poll' ? <PollPane {...session} /> : null}
      </fieldset>
    </div>
  );
}
