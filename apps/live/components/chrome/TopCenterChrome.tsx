import { lucidePencilLine } from '@livediagram/icons/lucide';
import { drawBannerMessage, isHeldPenIntent } from '@/lib/draw-mode';
import { participantKey } from '@/lib/identity';
import { FormatPainterIcon, lucideGlyph } from '@livediagram/ui';
import { isMobileViewportSync } from '@/lib/responsive';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { ModeBanner } from '@/components/chrome/ModeBanner';
import { TimerWidget } from '@/components/chrome/TimerWidget';
import { TopCenterBanner, TopCenterRow, TopCenterStack } from '@/components/chrome/TopCenter';
import { VoteBanner } from '@/components/chrome/VoteBanner';

// Everything that floats at the top of the canvas: the follow-me pill,
// the active editor-mode banner, the session timer and the vote
// banner. (The multi-selection toolbar now floats over the selection
// itself, via Canvas + FloatingToolbar.) Extracted from CanvasChrome so the
// chrome shell stays lean — this is one cohesive concern (the top-centre
// stack and its non-overlap layout) with its own props.
type TopCenterChromeProps = Pick<
  CanvasProps,
  | 'toolbarLayout'
  | 'selfParticipant'
  | 'readOnly'
  | 'pendingDraw'
  | 'onCancelDraw'
  | 'onCancelFormatPainter'
  | 'onExitFormatTool'
  | 'canvasTool'
  | 'formatSourceId'
  | 'tabTimer'
  | 'tabVote'
  | 'onPauseTimer'
  | 'onResumeTimer'
  | 'onResetTimer'
  | 'onClearTimer'
  | 'voteReview'
  | 'onNextVoteResult'
  | 'onPrevVoteResult'
  | 'onDoneVoteReview'
> & {
  // From CanvasChrome's computed ChromeExtras, not CanvasProps.
  isPaintMode: boolean;
  // A whiteboard's dock at the top (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits"):
  // the stack starts beneath it.
  dockOnTop?: boolean;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): who we are following, so the pill can say so and
  // offer the way out. Any canvas gesture also ends it silently — this is the
  // explicit door, not the only one.
  followingName?: string | null;
  onStopFollowing?: () => void;
};

export function TopCenterChrome({
  toolbarLayout,
  selfParticipant,
  readOnly,
  pendingDraw,
  onCancelDraw,
  onCancelFormatPainter,
  onExitFormatTool,
  canvasTool,
  formatSourceId,
  isPaintMode,
  dockOnTop = false,
  tabTimer,
  tabVote,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
  voteReview,
  onNextVoteResult,
  onPrevVoteResult,
  onDoneVoteReview,
  followingName,
  onStopFollowing,
}: TopCenterChromeProps) {
  return (
    <TopCenterStack
      below={dockOnTop ? 'dock' : toolbarLayout === true && !readOnly ? 'toolbar' : undefined}
    >
      {/* Follow-me (docs/specs/012-collaboration/follow-me-viewport.md). Shown on every viewport and in Zen mode: being
          moved around by somebody else without being told why is the one state
          this feature must never leave you in. */}
      {followingName ? (
        <TopCenterRow>
          {/* A TopCenterBanner rather than a hand-rolled pill, because the
              stack is `pointer-events-none` and each pill re-enables events
              for ITSELF. Built by hand, this one never did: Stop could not be
              clicked and did not even take the pointer cursor, so the only
              exit from being followed was a canvas gesture. */}
          <TopCenterBanner tone="live" className="gap-2 px-3 py-1 text-[11px] font-medium">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="max-w-[12rem] truncate">Following {followingName}</span>
            <button
              type="button"
              onClick={onStopFollowing}
              className="cursor-pointer rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold transition hover:bg-white/30"
            >
              Stop
            </button>
          </TopCenterBanner>
        </TopCenterRow>
      ) : null}
      {/* Active mode banner / multi-selection toolbar + the session timer.
          The timer sits to the RIGHT of the banner on desktop
          (sm:flex-row) and stacks UNDERNEATH it on mobile (flex-col).
          `empty:hidden` collapses the row (and its stack gap) when nothing
          in it is active. */}
      {/* The multi-selection toolbar used to sit here; it now floats over the
          selection (Canvas + FloatingToolbar). */}
      <TopCenterRow className="flex-col sm:flex-row empty:hidden">
        {/* Persistent Format tool (the palette tool): a two-phase guided
            banner. Phase 1 (no source armed) asks the user to pick a base;
            phase 2 (source armed) invites them to tap as many targets as
            they like. Checked before the single-shot painter banner below
            so the format tool owns the banner even once a source is armed
            (which also flips isPaintMode true). */}
        {canvasTool === 'format' ? (
          <ModeBanner
            icon={<FormatPainterIcon />}
            message={
              formatSourceId
                ? 'Tap elements to paint this style onto them'
                : 'Select a base element to copy its style'
            }
            actionLabel="Done"
            onAction={onExitFormatTool}
          />
        ) : isPaintMode ? (
          <ModeBanner
            icon={<FormatPainterIcon />}
            message="Click an element to apply formatting"
            onAction={onCancelFormatPainter}
          />
        ) : null}

        {/* The banner belongs to a one-shot ARM: "you picked a square, now
            drag one out", with a Cancel because the intent is transient. The
            highlighter is a held tool now (docs/specs/008-canvas/highlighter.md), so it is excluded here —
            a mode does not need telling you it is on every time you look up,
            and its colour + strength moved off this bar into the Highlighter
            Panel, where every other tool keeps its settings. */}
        {pendingDraw && !isHeldPenIntent(pendingDraw) ? (
          <ModeBanner
            icon={<DrawIcon />}
            message={drawBannerMessage(pendingDraw, isMobileViewportSync())}
            onAction={onCancelDraw}
          />
        ) : null}

        {/* Session timer (docs/specs/012-collaboration/session-tools.md), ticking locally off the tab timer. */}
        {tabTimer ? (
          <TimerWidget
            timer={tabTimer}
            readOnly={readOnly}
            onPause={onPauseTimer}
            onResume={onResumeTimer}
            onReset={onResetTimer}
            onClear={onClearTimer}
          />
        ) : null}
      </TopCenterRow>

      {/* Vote status (docs/specs/012-collaboration/session-tools.md), stacked below the timer row. While results
          are under review it becomes the walkthrough bar (Previous / Next /
          Done over the ordered top picks). */}
      {tabVote ? (
        <VoteBanner
          vote={tabVote}
          selfId={participantKey(selfParticipant)}
          review={voteReview}
          onNext={onNextVoteResult}
          onPrev={onPrevVoteResult}
          onDone={onDoneVoteReview}
        />
      ) : null}
    </TopCenterStack>
  );
}

const DrawIcon = lucideGlyph(lucidePencilLine, 14);
