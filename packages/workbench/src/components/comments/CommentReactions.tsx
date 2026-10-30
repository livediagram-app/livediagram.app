'use client';

// A comment's reactions (docs/specs/012-collaboration/comment-reactions.md in each product), drawn the same way on
// every comment surface in every product: the canvas's comment popover, the Comment panel, a Plan card's threads.
//
// Two parts a comment row places where they belong, sharing one tray state:
//   - `AddReactionButton`: the smile-plus in the row's actions, shown on hover or focus (always on a touch screen).
//   - `CommentReactions`: under the text, a chip per emoji used (the emoji and its count, yours highlighted; a press
//     toggles yours, hover or a long press says who) and, while open, the tray of six right there in the row,
//     where the chip it makes will land. No popover: the choice happens in place.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { HoverCard, SmilePlusIcon, Tooltip, useClickOutside, useEscape } from '@liveworkspace/ui';
import {
  COMMENT_REACTIONS,
  hasReacted,
  reactionDef,
  reactionGroups,
  reactorsLine,
  type CommentReaction,
  type ReactionGroup,
  type CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';

export type ReactionDensity = 'compact' | 'comfortable';

export type ReactionTray = {
  open: boolean;
  setOpen: (open: boolean) => void;
  // The trigger, so closing the tray from the keyboard hands focus back to it.
  triggerRef: RefObject<HTMLButtonElement | null>;
};

// One comment row's tray state.
export function useReactionTray(): ReactionTray {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return { open, setOpen, triggerRef };
}

// The add-reaction trigger. Hidden until the row is hovered or something in it has focus (the row carries
// Tailwind's `group`); always there where nothing hovers, so a phone can reach it.
export function AddReactionButton({
  tray,
  density = 'compact',
}: {
  tray: ReactionTray;
  density?: ReactionDensity;
}) {
  const box = density === 'comfortable' ? 'h-7 w-7' : 'h-6 w-6';
  const { open, setOpen, triggerRef } = tray;
  return (
    <Tooltip label="Add Reaction">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add Reaction"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex ${box} shrink-0 cursor-pointer items-center justify-center self-start rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white [@media(hover:none)]:opacity-100 ${
          open
            ? 'bg-slate-100 text-slate-900 opacity-100 dark:bg-slate-800 dark:text-white'
            : 'opacity-0'
        }`}
      >
        <SmilePlusIcon size={density === 'comfortable' ? 15 : 13} />
      </button>
    </Tooltip>
  );
}

type CommentReactionsProps = {
  reactions: readonly CommentReaction[] | undefined;
  // This session's collab key: the reactions it matches are yours (highlighted, and a press takes them back).
  selfKey: string | null;
  // Your name, so the list of who reacted reads "You" in its place.
  selfName?: string;
  // Whoever may comment may react (a Viewer only looks, docs/specs/013-workspace/share-roles.md). Without it the
  // chips still show who reacted, but press nothing and the tray never opens.
  canReact: boolean;
  onToggle: (emoji: CommentReactionId, on: boolean) => void;
  tray: ReactionTray;
  density?: ReactionDensity;
};

export function CommentReactions({
  reactions,
  selfKey,
  selfName,
  canReact,
  onToggle,
  tray,
  density = 'compact',
}: CommentReactionsProps) {
  const groups = reactionGroups(reactions, selfKey);
  const trayOpen = tray.open && canReact;
  if (!groups.length && !trayOpen) return null;
  const pick = (emoji: CommentReactionId) => {
    onToggle(emoji, !hasReacted(reactions, emoji, selfKey));
  };
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${density === 'comfortable' ? 'mt-1.5' : 'mt-1'}`}
      data-comment-reactions=""
    >
      {groups.map((group) => (
        <ReactionChip
          key={group.emoji}
          group={group}
          selfName={selfName}
          canReact={canReact}
          density={density}
          onPress={() => pick(group.emoji)}
        />
      ))}
      {trayOpen ? (
        <ReactionPicker
          reactions={reactions}
          selfKey={selfKey}
          density={density}
          onPick={(emoji) => {
            pick(emoji);
            tray.setOpen(false);
          }}
          onClose={(refocus) => {
            tray.setOpen(false);
            if (refocus) tray.triggerRef.current?.focus();
          }}
          triggerRef={tray.triggerRef}
        />
      ) : null}
    </div>
  );
}

function ReactionChip({
  group,
  selfName,
  canReact,
  density,
  onPress,
}: {
  group: ReactionGroup;
  selfName?: string;
  canReact: boolean;
  density: ReactionDensity;
  onPress: () => void;
}) {
  const def = reactionDef(group.emoji);
  const who = reactorsLine(group, selfName);
  const comfortable = density === 'comfortable';
  const tone = group.mine
    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-400/50 dark:bg-brand-500/15 dark:text-brand-200'
    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
  const press = canReact
    ? group.mine
      ? 'cursor-pointer hover:border-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/25'
      : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/70'
    : 'cursor-default';
  return (
    <HoverCard title={`${def.emoji} ${def.name}`} description={`${who} reacted`} pressWithText>
      <button
        type="button"
        aria-label={`${def.name}, ${group.count}`}
        aria-pressed={canReact ? group.mine : undefined}
        aria-disabled={canReact ? undefined : true}
        onClick={canReact ? onPress : undefined}
        className={`inline-flex select-none items-center gap-1 rounded-full border font-medium tabular-nums transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 [-webkit-touch-callout:none] ${
          comfortable ? 'h-7 px-2.5 text-[12px]' : 'h-6 px-2 text-[11px]'
        } ${tone} ${press}`}
      >
        {/* Keyed on whether it is yours, so adding yours remounts it and it pops; a new chip pops on arrival. */}
        <span
          key={group.mine ? 'mine' : 'theirs'}
          aria-hidden
          className={`text-optical-centre inline-block animate-reaction-pop leading-none motion-reduce:animate-none ${
            comfortable ? 'text-[14px]' : 'text-[13px]'
          }`}
        >
          {def.emoji}
        </span>
        <span aria-hidden className="text-optical-centre">
          {group.count}
        </span>
      </button>
    </HoverCard>
  );
}

// The tray: the six, in a pill that opens in place in the reactions row. Yours are marked; a pick toggles and
// closes. Arrow keys move along it, Escape closes it and hands focus back to the trigger, and a press anywhere else
// closes it.
function ReactionPicker({
  reactions,
  selfKey,
  density,
  onPick,
  onClose,
  triggerRef,
}: {
  reactions: readonly CommentReaction[] | undefined;
  selfKey: string | null;
  density: ReactionDensity;
  onPick: (emoji: CommentReactionId) => void;
  onClose: (refocus: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const comfortable = density === 'comfortable';
  // A press on the trigger is the trigger's own toggle, not an outside press.
  const outside = useCallback(
    (e: PointerEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      onClose(false);
    },
    [onClose, triggerRef],
  );
  useClickOutside(ref, outside);
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });
  // Opened from the keyboard or a click alike, focus lands on the first emoji, so the arrows work at once.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === 'ArrowRight'
        ? (at + 1) % buttons.length
        : e.key === 'ArrowLeft'
          ? (at - 1 + buttons.length) % buttons.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? buttons.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    buttons[to]?.focus();
  };
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Reactions"
      onKeyDown={onKeyDown}
      className="inline-flex origin-left animate-reaction-tray items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-md shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40"
    >
      {COMMENT_REACTIONS.map((def) => {
        const mine = hasReacted(reactions, def.id, selfKey);
        return (
          <Tooltip key={def.id} label={def.name}>
            <button
              type="button"
              aria-label={def.name}
              aria-pressed={mine}
              onClick={() => onPick(def.id)}
              className={`flex cursor-pointer items-center justify-center rounded-full leading-none transition hover:scale-125 hover:bg-slate-100 focus-visible:scale-125 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100 dark:hover:bg-slate-700 ${
                comfortable ? 'h-8 w-8 text-[18px]' : 'h-7 w-7 text-[16px]'
              } ${mine ? 'bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-400/50' : ''}`}
            >
              <span aria-hidden className="text-optical-centre">
                {def.emoji}
              </span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
