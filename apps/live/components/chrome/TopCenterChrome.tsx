import { drawBannerMessage } from '@/lib/draw-mode';
import { isMobileViewportSync } from '@/lib/responsive';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { ModeBanner } from '@/components/chrome/ModeBanner';
import { GroupIcon } from '@/components/canvas/selection-popover-icons';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { TimerWidget } from '@/components/chrome/TimerWidget';
import { HighlighterBannerControls } from '@/components/chrome/HighlighterBannerControls';
import { TopCenterRow, TopCenterStack } from '@/components/chrome/TopCenter';
import { VoteBanner } from '@/components/chrome/VoteBanner';

// Everything that floats at the top of the canvas: the owner / role
// badge, the active editor-mode banner, the session timer and the vote
// banner. (The multi-selection toolbar now floats over the selection
// itself, via Canvas + FloatingToolbar.) Extracted from CanvasChrome so the
// chrome shell stays lean — this is one cohesive concern (the top-centre
// stack and its non-overlap layout) with its own props.
type TopCenterChromeProps = Pick<
  CanvasProps,
  | 'isOwner'
  | 'zenMode'
  | 'ownerParticipant'
  | 'selfParticipant'
  | 'readOnly'
  | 'pendingDraw'
  | 'onCancelDraw'
  | 'highlighterColor'
  | 'highlighterWidth'
  | 'onSetHighlighterColor'
  | 'onSetHighlighterWidth'
  | 'onCancelFormatPainter'
  | 'onExitFormatTool'
  | 'canvasTool'
  | 'formatSourceId'
  | 'onCancelGroup'
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
  isGroupMode: boolean;
  // Follow-me (spec/131): who we are following, so the pill can say so and
  // offer the way out. Any canvas gesture also ends it silently — this is the
  // explicit door, not the only one.
  followingName?: string | null;
  onStopFollowing?: () => void;
};

export function TopCenterChrome({
  isOwner,
  zenMode,
  ownerParticipant,
  selfParticipant,
  readOnly,
  pendingDraw,
  onCancelDraw,
  highlighterColor,
  highlighterWidth,
  onSetHighlighterColor,
  onSetHighlighterWidth,
  onCancelFormatPainter,
  onExitFormatTool,
  canvasTool,
  formatSourceId,
  onCancelGroup,
  isPaintMode,
  isGroupMode,
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
    <TopCenterStack>
      {/* Follow-me (spec/131). Shown on every viewport and in Zen mode: being
          moved around by somebody else without being told why is the one state
          this feature must never leave you in. */}
      {followingName ? (
        <TopCenterRow>
          <div className="flex items-center gap-2 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-medium text-white shadow-sm">
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
          </div>
        </TopCenterRow>
      ) : null}
      {/* Visitor-only owner + role badge. Desktop-only: the top row is
          too tight on a phone, and the role stays discoverable from the
          no-add palette + locked-element affordances. */}
      {!isOwner && !zenMode ? (
        <TopCenterRow className="hidden sm:flex">
          {ownerParticipant ? (
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">Owner:</span>
              <ParticipantAvatar participant={ownerParticipant} size={14} />
              <span className="max-w-[10rem] truncate">{ownerParticipant.name}</span>
            </div>
          ) : null}
          <div
            className={
              'rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ' +
              (readOnly
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200')
            }
          >
            {readOnly ? 'Viewing' : 'Editing'}
          </div>
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
            icon={<PaintIcon />}
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
            icon={<PaintIcon />}
            message="Click an element to apply formatting"
            onAction={onCancelFormatPainter}
          />
        ) : null}

        {isGroupMode ? (
          <ModeBanner
            icon={<GroupIcon size={14} />}
            message="Click another element to add to the group"
            actionLabel="Done"
            onAction={onCancelGroup}
          />
        ) : null}

        {pendingDraw ? (
          <ModeBanner
            icon={<DrawIcon />}
            message={drawBannerMessage(pendingDraw, isMobileViewportSync())}
            onAction={onCancelDraw}
            // Pen-mode-only extras slot. The "recognise shapes" toggle that
            // used to live here is gone (spec/115): recognition is now which
            // pen you picked — Freehand or Shape Pen — rather than a hidden
            // mode you had to check before every stroke.
            extras={
              pendingDraw.type === 'freehand' && pendingDraw.variant === 'highlighter' ? (
                <HighlighterBannerControls
                  color={highlighterColor}
                  width={highlighterWidth}
                  onSetColor={onSetHighlighterColor}
                  onSetWidth={onSetHighlighterWidth}
                />
              ) : undefined
            }
          />
        ) : null}

        {/* Session timer (spec/39), ticking locally off the tab timer. */}
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

      {/* Vote status (spec/39), stacked below the timer row. While results
          are under review it becomes the walkthrough bar (Previous / Next /
          Done over the ordered top picks). */}
      {tabVote ? (
        <VoteBanner
          vote={tabVote}
          selfId={selfParticipant.id}
          review={voteReview}
          onNext={onNextVoteResult}
          onPrev={onPrevVoteResult}
          onDone={onDoneVoteReview}
        />
      ) : null}
    </TopCenterStack>
  );
}

function PaintIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 2.5l-6 6" />
      <path d="M7 8l1.5 1.5" />
      <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
    </svg>
  );
}

function DrawIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.5" />
      <path d="M5.5 5.5l5 5" />
    </svg>
  );
}
