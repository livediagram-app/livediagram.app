'use client';

// The session settings body as an ELEMENT menu renders it (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/session-button.md).
//
// Same components the Session Studio uses, so a timer's `…` popover, that
// element's right-click Session category, and the Studio pane are one UI
// rather than three. They were three: a dial in the Studio, eight stacked
// "N minutes" rows in the popover, and a number field in the context menu —
// three answers to one question, which is how they came to disagree.
//
// Reads the session verbs off EditorContext rather than taking them as props,
// because threading them would mean new props on Canvas and every element face
// on the way down, and the faces are memoised precisely so a canvas of a
// hundred elements does not re-render on unrelated state. This is safe HERE
// because of where it mounts: `ElementEllipsisMenu` invokes its children only
// while the popover is OPEN, and the context menu likewise renders its
// sections on open, so nothing subscribes until somebody asks to see it.
//
// CONTROLLED against the element's own config: dragging the dial writes the
// element's stored minutes, and Start runs the room's timer with that same
// value. One number doing both jobs, which is what lets the Studio's component
// serve an element without a mode flag.

import { useState } from 'react';
import {
  DEFAULT_SESSION_POLL_STYLE,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_VOTE_DOTS,
  isPollStyle,
  type SessionButtonConfig,
  type TimerMode,
} from '@livediagram/diagram';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { TimerSetupBody } from '@/components/panels/session-studio/TimerSetupBody';
import { VoteSetupBody } from '@/components/panels/session-studio/VotePane';
import { PollComposerBody } from '@/components/panels/session-studio/PollPane';

// The Session Studio's pane body measures 286px wide including its own p-3.
// Matched here rather than approximated, so the identical component is not
// laid out two different ways — the tiles in particular wrap differently at
// 240px, which is how "Collaborators" ended up truncated.
const BODY_CLASS = 'w-[286px] p-3';

export function SessionTimerSettings({
  config,
  onChange,
  onClose,
}: {
  config: SessionButtonConfig;
  onChange: (next: SessionButtonConfig) => void;
  /** Closing on start: the timer is now on screen for everybody. */
  onClose?: () => void;
}) {
  const { startTimer } = useEditorContext();
  // Mode is not stored on the element — a session button starts a countdown of
  // its configured length — so it is local, and only decides which face of the
  // body you are looking at.
  const [mode, setMode] = useState<TimerMode>('countdown');
  const minutes = config.minutes ?? DEFAULT_TIMER_MINUTES;

  return (
    <div className={BODY_CLASS}>
      <TimerSetupBody
        minutes={minutes}
        onMinutesChange={(m) => onChange({ ...config, minutes: m })}
        mode={mode}
        onModeChange={setMode}
        // A timer element is a countdown. A stopwatch is its own element, so
        // offering the toggle here would offer to turn one into the other.
        showModeToggle={false}
        onStartTimer={(m, durationMs) => {
          startTimer(m, durationMs);
          onClose?.();
        }}
      />
    </div>
  );
}

function SessionVoteSettings({
  config,
  onChange,
  onClose,
}: {
  config: SessionButtonConfig;
  onChange: (next: SessionButtonConfig) => void;
  onClose?: () => void;
}) {
  const { startVote, layers, activeLayerId } = useEditorContext();
  return (
    <div className={BODY_CLASS}>
      <VoteSetupBody
        voteLayers={layers}
        activeLayerId={activeLayerId}
        dots={config.dots ?? DEFAULT_VOTE_DOTS}
        onDotsChange={(dots) => onChange({ ...config, dots })}
        onStartVote={(dots, setup) => {
          startVote(dots, setup);
          onClose?.();
        }}
      />
    </div>
  );
}

function SessionPollSettings({
  config,
  onChange,
  onClose,
}: {
  config: SessionButtonConfig;
  onChange: (next: SessionButtonConfig) => void;
  onClose?: () => void;
}) {
  const { livePoll, pollCollaborators, diagramShareable, diagramTeamId } = useEditorContext();
  return (
    <div className={BODY_CLASS}>
      <PollComposerBody
        hasAudience={diagramShareable || !!diagramTeamId}
        collaborators={pollCollaborators}
        question={config.question ?? ''}
        onQuestionChange={(question) => onChange({ ...config, question })}
        style={isPollStyle(config.style) ? config.style : DEFAULT_SESSION_POLL_STYLE}
        onStyleChange={(style) => onChange({ ...config, style })}
        options={config.options ?? []}
        onOptionsChange={(options) => onChange({ ...config, options })}
        onStartPoll={(draft) => {
          livePoll.startPoll(draft);
          onClose?.();
        }}
      />
    </div>
  );
}

function SessionStopwatchSettings({ onClose }: { onClose?: () => void }) {
  const { startTimer } = useEditorContext();
  // Nothing to configure — that is the whole point of it being its own tool.
  // The body is the Studio's stopwatch face: the sweep dial and one button.
  return (
    <div className={BODY_CLASS}>
      <TimerSetupBody
        minutes={0}
        onMinutesChange={() => {}}
        mode="stopwatch"
        onModeChange={() => {}}
        showModeToggle={false}
        onStartTimer={(m) => {
          startTimer(m);
          onClose?.();
        }}
      />
    </div>
  );
}

/** The right body for whichever session tool this element is. */
export function SessionElementSettings(props: {
  config: SessionButtonConfig;
  onChange: (next: SessionButtonConfig) => void;
  onClose?: () => void;
}) {
  if (props.config.tool === 'timer') return <SessionTimerSettings {...props} />;
  if (props.config.tool === 'stopwatch')
    return <SessionStopwatchSettings onClose={props.onClose} />;
  if (props.config.tool === 'vote') return <SessionVoteSettings {...props} />;
  return <SessionPollSettings {...props} />;
}
