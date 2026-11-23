'use client';

// The page's reactions in its floating corner (docs/specs/030-knowledgebase/page-reactions.md "Where they show"): one
// quiet capsule left of Edit (in Edit's place for a Viewer), a segment an emoji used, +N past the room, and Add
// Reaction at its end. Reads its own store slice (usePageReactions), so a reaction renders this alone.
import { SmilePlusIcon, Tooltip, useMediaQuery } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useKnowledgeView } from '@/lib/knowledge-ask/useKnowledgeView';
import { useVersionHistoryState } from '@/lib/version-history-store';
import {
  CAPSULE_SEGMENTS,
  CAPSULE_SEGMENTS_NARROW,
  capsuleSplit,
  type PageReactionGroup,
} from '@/lib/page-reactions/reaction-groups';
import { PageReactionPicker, useReactionPicker } from './PageReactionPicker';
import { ReactionSegment } from './ReactionSegment';
import { usePageReactions } from './usePageReactions';

const NARROW = '(max-width: 639.98px)';

const TAIL =
  'inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] px-1.5 text-[13px] font-semibold text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 phone:h-11 phone:min-w-11 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white';

export type PageReactionsCapsuleProps = {
  groups: readonly PageReactionGroup[];
  canReact: boolean;
  selfName: string;
  onToggle: (emoji: string) => void;
  /** How many segments stand before +N. */
  room: number;
};

/** The capsule from plain props (tests, and the store-reading wrapper below). Nothing when there is nothing to
 *  show: no reactions, and nobody here who may add one. */
export function PageReactionsCapsule({
  groups,
  canReact,
  selfName,
  onToggle,
  room,
}: PageReactionsCapsuleProps) {
  const picker = useReactionPicker();
  if (groups.length === 0 && !canReact) return null;
  const { shown, more } = capsuleSplit(groups, room);
  return (
    <>
      <div
        role="group"
        aria-label="Reactions"
        data-page-reactions=""
        className="lk-pop-in inline-flex h-10 shrink-0 items-center gap-0.5 rounded-xl bg-white px-1 phone:px-0.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 phone:h-11 dark:bg-slate-800 dark:shadow-black/40 dark:ring-slate-700"
      >
        {shown.map((g) => (
          <ReactionSegment
            key={g.emoji}
            group={g}
            selfName={selfName}
            canReact={canReact}
            onPress={() => onToggle(g.emoji)}
          />
        ))}
        {more > 0 ? (
          <Tooltip label={`${more} More ${more === 1 ? 'Reaction' : 'Reactions'}`}>
            <button
              type="button"
              data-reaction-more=""
              aria-label={`${more} More ${more === 1 ? 'Reaction' : 'Reactions'}`}
              aria-expanded={picker.open}
              aria-haspopup="dialog"
              onClick={(e) => picker.openFrom(e.currentTarget)}
              className={`${TAIL} tabular-nums`}
            >
              +{more}
            </button>
          </Tooltip>
        ) : null}
        {canReact ? (
          <Tooltip label="Add Reaction">
            <button
              type="button"
              data-reaction-add=""
              aria-label="Add Reaction"
              aria-expanded={picker.open}
              aria-haspopup="dialog"
              onClick={(e) => picker.openFrom(e.currentTarget)}
              className={`${TAIL} ${picker.open ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : ''}`}
            >
              <SmilePlusIcon size={17} />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <PageReactionPicker
        picker={picker}
        groups={groups}
        canReact={canReact}
        selfName={selfName}
        onToggle={onToggle}
      />
    </>
  );
}

/** The current page's reactions, from the store. */
export function PageReactions() {
  const view = usePageReactions();
  const narrow = useMediaQuery(NARROW);
  if (view.hidden) return null;
  return (
    <PageReactionsCapsule
      groups={view.groups}
      canReact={view.canReact}
      selfName={view.selfName}
      onToggle={view.toggle}
      room={narrow ? CAPSULE_SEGMENTS_NARROW : CAPSULE_SEGMENTS}
    />
  );
}

/** For someone who may not edit (a Viewer, a view link's visitor): the capsule in the corner cluster, left of Zen,
 *  where Edit would stand beside it for an Editor. Nothing for whoever may edit: theirs stand left of Edit
 *  (PageEditBar). Never in Zen Mode, an embed, Version History, or on Ask and Insights. */
export function PageReactionsBesideZen() {
  const mayEdit = useEditorChrome((s) => s.pageEditing.mayEdit);
  const shown = useEditorChrome((s) => !s.embedMode && !s.zenMode);
  const inHistory = useVersionHistoryState() !== null;
  const onPages = useKnowledgeView() === 'pages';
  if (mayEdit || !shown || inHistory || !onPages) return null;
  return (
    <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
      <PageReactions />
    </div>
  );
}
