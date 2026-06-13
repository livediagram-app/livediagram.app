import dynamic from 'next/dynamic';
import { drawBannerMessage } from '@/lib/draw-mode';
import { isMobileViewportSync } from '@/lib/responsive';
import type { CanvasProps } from './Canvas.types';
import { ModeBanner } from './ModeBanner';
import { ParticipantAvatar } from './ParticipantAvatar';
import { TimerWidget } from './TimerWidget';
import { Tooltip } from './Tooltip';
import { TopCenterRow, TopCenterStack } from './TopCenter';
import { VoteBanner } from './VoteBanner';

// Lazy-load MultiSelectionToolbar: only mounts when the user has
// drag-marquee'd two or more elements. Most sessions never trigger it
// (single-element edits dominate), so deferring the toolbar + its icon
// set keeps the editor's initial chunk lean.
const MultiSelectionToolbar = dynamic(() =>
  import('./MultiSelectionToolbar').then((m) => m.MultiSelectionToolbar),
);

// Everything that floats at the top of the canvas: the owner / role
// badge, the active editor-mode banner, the multi-selection toolbar, the
// session timer and the vote banner. Extracted from CanvasChrome so the
// chrome shell stays lean — this is one cohesive concern (the top-centre
// stack and its non-overlap layout) with its own props.
type TopCenterChromeProps = Pick<
  CanvasProps,
  | 'isOwner'
  | 'zenMode'
  | 'ownerParticipant'
  | 'selfParticipant'
  | 'readOnly'
  | 'elements'
  | 'multiSelectedIds'
  | 'onDuplicateMultiSelected'
  | 'onDeleteMultiSelected'
  | 'onGroupMultiSelected'
  | 'onToggleLockMultiSelected'
  | 'onExportMultiSelected'
  | 'pendingDraw'
  | 'onCancelDraw'
  | 'recogniseShapes'
  | 'onToggleRecogniseShapes'
  | 'onCancelFormatPainter'
  | 'onCancelGroup'
  | 'tabTimer'
  | 'tabVote'
  | 'onPauseTimer'
  | 'onResumeTimer'
  | 'onResetTimer'
> & {
  // From CanvasChrome's computed ChromeExtras, not CanvasProps.
  isPaintMode: boolean;
  isGroupMode: boolean;
};

export function TopCenterChrome({
  isOwner,
  zenMode,
  ownerParticipant,
  selfParticipant,
  readOnly,
  elements,
  multiSelectedIds,
  onDuplicateMultiSelected,
  onDeleteMultiSelected,
  onGroupMultiSelected,
  onToggleLockMultiSelected,
  onExportMultiSelected,
  pendingDraw,
  onCancelDraw,
  recogniseShapes,
  onToggleRecogniseShapes,
  onCancelFormatPainter,
  onCancelGroup,
  isPaintMode,
  isGroupMode,
  tabTimer,
  tabVote,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
}: TopCenterChromeProps) {
  return (
    <TopCenterStack>
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
      <TopCenterRow className="flex-col sm:flex-row empty:hidden">
        {multiSelectedIds.size >= 2 && !readOnly ? (
          <MultiSelectionToolbar
            count={multiSelectedIds.size}
            anyLocked={elements.some((el) => multiSelectedIds.has(el.id) && el.locked === true)}
            allLocked={elements
              .filter((el) => multiSelectedIds.has(el.id))
              .every((el) => el.locked === true)}
            onDuplicate={onDuplicateMultiSelected}
            onDelete={onDeleteMultiSelected}
            onGroup={onGroupMultiSelected}
            onToggleLock={onToggleLockMultiSelected}
            onExport={onExportMultiSelected}
          />
        ) : null}

        {isPaintMode ? (
          <ModeBanner
            icon={<PaintIcon />}
            message="Click an element to apply formatting"
            onAction={onCancelFormatPainter}
          />
        ) : null}

        {isGroupMode ? (
          <ModeBanner
            icon={<GroupIcon />}
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
            // Pen-mode-only extras slot: the "recognise shapes" toggle.
            // Icon-only with a Tooltip (bold title + one-line description)
            // so the symbol's meaning is discoverable without clutter; the
            // pressed state (brand-200 fill) signals when the mode is
            // active so the user always knows whether the next stroke will
            // convert or stay as a sketch. The on/off state is a persisted
            // user preference (spec/20 `recogniseShapes`) lifted to
            // editor-page, so it survives across pencil sessions and
            // across devices.
            extras={
              pendingDraw.type === 'freehand' ? (
                <RecogniseShapesToggle
                  on={recogniseShapes}
                  onToggle={onToggleRecogniseShapes}
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
          />
        ) : null}
      </TopCenterRow>

      {/* Vote status (spec/39), stacked below the timer row. */}
      {tabVote ? <VoteBanner vote={tabVote} selfId={selfParticipant.id} /> : null}
    </TopCenterStack>
  );
}

function RecogniseShapesToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Tooltip
      title={on ? 'Recognise shapes: on' : 'Recognise shapes: off'}
      description={
        on
          ? 'Strokes that resemble rectangles, circles, diamonds, or lines auto-convert. Click to keep sketches as-is.'
          : 'Click to auto-convert strokes that resemble rectangles, circles, diamonds, or lines.'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle shape recognition"
        aria-pressed={on}
        className={
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ' +
          (on
            ? 'bg-brand-200 text-brand-900 hover:bg-brand-300'
            : 'bg-white text-slate-700 hover:bg-slate-50')
        }
      >
        {/* Sparkle / magic-wand glyph signals "auto" without being a
            literal AI motif. Two-star composition so it parses at 14px. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 2 L6.9 4.6 L9.5 5.5 L6.9 6.4 L6 9 L5.1 6.4 L2.5 5.5 L5.1 4.6 Z" />
          <path d="M11.5 9 L12.1 10.4 L13.5 11 L12.1 11.6 L11.5 13 L10.9 11.6 L9.5 11 L10.9 10.4 Z" />
        </svg>
      </button>
    </Tooltip>
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

function GroupIcon() {
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
      <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
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
