// The pressable face of a Session button (spec/105): the tool's glyph over
// what pressing it will do.
//
// Deliberately the Selection Mode button's twin — same tile, same chip, same
// press-not-on-drag rule — because they are the same object with a different
// payload: one hands YOU a mode, this one starts a tool for THE ROOM. The one
// place they differ is that difference: the tooltip says "everyone", and a
// read-only visitor sees an inert face instead of a control that would do
// nothing (starting a timer or a vote is edit-role, spec/39).

import {
  sessionButtonPlan,
  type SessionButtonConfig,
  type SessionPlan,
} from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { PollIcon, TimerIcon, VoteIcon } from '@/components/palette/palette-icons';

const TOOL_ICON: Record<SessionPlan['tool'], React.ReactNode> = {
  timer: <TimerIcon />,
  vote: <VoteIcon />,
  poll: <PollIcon />,
};

// What the face says when the author hasn't written their own label. Derived
// from the SETTING, not just the tool, so re-pointing a button relabels it and
// the board reads as instructions ("Vote — 3 dots each").
export function sessionButtonText(
  plan: SessionPlan | null,
  // What the tab's timer is doing, so a timer button reads as the control it
  // is mid-session ("Pause timer") rather than always promising a fresh start.
  timerState: TimerState = 'none',
): { kicker: string; action: string } {
  if (!plan) return { kicker: 'Poll', action: 'Not set up' };
  if (plan.tool === 'timer') {
    if (timerState === 'running') return { kicker: 'Pause', action: 'the timer' };
    if (timerState === 'paused') return { kicker: 'Continue', action: 'the timer' };
    return { kicker: 'Start', action: `${plan.minutes} min timer` };
  }
  if (plan.tool === 'vote') {
    return {
      kicker: 'Start vote',
      action: `${plan.dots} ${plan.dots === 1 ? 'dot' : 'dots'} each`,
    };
  }
  return { kicker: 'Ask the room', action: plan.question };
}

// A tab's timer is either absent, counting, or held.
export type TimerState = 'none' | 'running' | 'paused';

const TOOL_BLURB: Record<SessionPlan['tool'], string> = {
  timer: 'Starts a countdown everyone in the room can see.',
  vote: 'Starts a dot vote on this tab for everyone.',
  poll: 'Opens this poll on everyone’s screen; answers are anonymous.',
};

const ICON_BOX = 'flex items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px]';

export function SessionButtonFace({
  config,
  label,
  textColor,
  // False on a read-only surface (a view-role visitor, an embed): the face
  // renders inert and says why rather than looking live.
  canStart,
  timerState = 'none',
  onPress,
}: {
  config: SessionButtonConfig | undefined;
  label: string;
  textColor: string;
  canStart: boolean;
  timerState?: TimerState;
  onPress?: () => void;
}) {
  const plan = sessionButtonPlan(config);
  const derived = sessionButtonText(plan, timerState);
  const text = label.trim();
  const press = usePressWithoutDrag(onPress);
  const tool = plan?.tool ?? 'poll';

  const inner = (
    <>
      <span
        className={`${ICON_BOX} h-9 w-9 shrink-0 rounded-full bg-black/[0.055] ring-1 ring-inset ring-black/[0.07] dark:bg-white/10 dark:ring-white/15`}
        style={{ color: textColor }}
        aria-hidden
      >
        {TOOL_ICON[tool]}
      </span>
      {text ? (
        <span
          className="w-full px-2 text-center text-[12px] font-semibold leading-tight"
          style={{ color: textColor }}
        >
          {text}
        </span>
      ) : (
        <span className="flex flex-col items-center gap-0.5 px-1 leading-none">
          <span
            className="text-[9px] font-medium uppercase tracking-[0.08em] opacity-70"
            style={{ color: textColor }}
          >
            {derived.kicker}
          </span>
          <span
            className="line-clamp-2 text-center text-[12px] font-semibold"
            style={{ color: textColor }}
          >
            {derived.action}
          </span>
        </span>
      )}
    </>
  );

  // Shared by every state so a read-only render looks identical, minus the
  // interaction. Untinted, like the Selection Mode button: the element's own
  // fill is the button.
  const layout =
    'flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]';

  if (!plan) {
    return (
      <Tooltip
        block
        className="h-full w-full"
        title="Poll not set up"
        description="Right-click the button and open Tools › Session to write a question and at least two answers."
      >
        <div aria-disabled className={`pointer-events-auto cursor-default opacity-60 ${layout}`}>
          {inner}
        </div>
      </Tooltip>
    );
  }
  if (!onPress || !canStart) {
    return (
      <Tooltip
        block
        className="h-full w-full"
        title={text || `${derived.kicker} ${derived.action}`}
        description={
          canStart
            ? TOOL_BLURB[plan.tool]
            : 'Only people with edit access can start this. You can still take part once it starts.'
        }
      >
        <div aria-disabled className={`pointer-events-auto cursor-default opacity-60 ${layout}`}>
          {inner}
        </div>
      </Tooltip>
    );
  }
  return (
    <Tooltip
      block
      className="h-full w-full"
      title={text || `${derived.kicker} ${derived.action}`}
      description={
        plan.tool === 'timer' && timerState !== 'none'
          ? timerState === 'running'
            ? 'Holds the countdown for everyone. Press again to continue it.'
            : 'Continues the countdown from where it was paused.'
          : TOOL_BLURB[plan.tool]
      }
    >
      <button
        type="button"
        aria-label={`${text || `${derived.kicker} ${derived.action}`} — starts this for everyone`}
        {...press}
        className={`pointer-events-auto cursor-pointer rounded-[inherit] transition duration-100 active:scale-[0.96] active:brightness-95 sm:hover:brightness-[1.07] ${layout}`}
      >
        {inner}
      </button>
    </Tooltip>
  );
}
