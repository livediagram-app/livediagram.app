'use client';

// One emoji used on a page (docs/specs/030-knowledgebase/page-reactions.md "Where they show"): its emoji and count,
// yours tinted in the accent; a press adds yours or takes it back; hover, focus or a long press names who reacted.
import { HoverCard } from '@liveknowledge/ui';
import { reactorsLine } from '@liveworkspace/model-core/comment-reactions';
import { loadedEmojiName } from '@/components/page-icon/PageIconPicker';
import { quickReactionName, type PageReactionGroup } from '@/lib/page-reactions/reaction-groups';

/** The emoji's name: a quick pick's, the picker list's once fetched, else "Reaction". */
export const reactionName = (emoji: string): string =>
  quickReactionName(emoji) ?? loadedEmojiName(emoji) ?? 'Reaction';

export function ReactionSegment({
  group,
  selfName,
  canReact,
  onPress,
  framed = false,
}: {
  group: PageReactionGroup;
  selfName: string;
  canReact: boolean;
  onPress: () => void;
  /** Drawn on its own (in the picker), with a ring of its own; inside the capsule, the capsule is its frame. */
  framed?: boolean;
}) {
  const name = reactionName(group.emoji);
  const tone = group.mine
    ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-400/50'
    : `text-slate-700 dark:text-slate-200 ${framed ? 'ring-1 ring-inset ring-slate-200 dark:ring-slate-700' : ''}`;
  const press = canReact
    ? group.mine
      ? 'cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-500/30'
      : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700'
    : 'cursor-default';
  return (
    <HoverCard
      title={`${group.emoji} ${name}`}
      description={`${reactorsLine(group, selfName || undefined)} reacted`}
      pressWithText
    >
      <button
        type="button"
        data-reaction-segment={group.emoji}
        aria-label={`${name}, ${group.count}`}
        aria-pressed={canReact ? group.mine : undefined}
        aria-disabled={canReact ? undefined : true}
        onClick={canReact ? onPress : undefined}
        className={`inline-flex h-8 min-w-10 select-none items-center justify-center gap-1 rounded-[9px] px-2 text-[13px] font-semibold tabular-nums transition duration-micro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 [-webkit-touch-callout:none] phone:h-11 phone:min-w-11 ${tone} ${press}`}
      >
        {/* Keyed on whether it is yours, so adding yours pops it. */}
        <span
          key={group.mine ? 'mine' : 'theirs'}
          aria-hidden
          className="text-optical-centre inline-block animate-reaction-pop text-[16px] leading-none motion-reduce:animate-none"
        >
          {group.emoji}
        </span>
        <span aria-hidden className="text-optical-centre">
          {group.count}
        </span>
      </button>
    </HoverCard>
  );
}
