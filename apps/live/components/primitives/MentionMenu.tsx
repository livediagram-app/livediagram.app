'use client';

// The `@` suggestion list above a comment composer (docs/specs/012-collaboration/comment-mentions.md): up to
// six teammates, each with their initials, name and handle, invited ones
// tagged. A floating menu in the app's chrome style, so it reads the same over
// a themed card as over the comment popover. Pointer-down keeps focus in the
// field (the pick writes into it) and never starts a canvas drag.

import { Chip, GlyphDisc, SOLID_BRAND_DARK } from '@livediagram/ui';
import { initialsOf } from '@/lib/identity';
import type { MentionCandidate } from '@/hooks/collab/useCommentMentions';

export function MentionMenu({
  items,
  highlight,
  hint,
  onPick,
}: {
  items: readonly MentionCandidate[];
  highlight: number;
  hint: string | null;
  onPick: (index: number) => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto absolute bottom-full left-0 right-0 z-20 mb-1.5 animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {hint ? (
        <p className="px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : (
        <ul role="listbox" aria-label="Mention a teammate" className="flex flex-col gap-0.5">
          {items.map((c, i) => (
            <li
              key={c.memberId}
              role="option"
              aria-selected={i === highlight}
              onClick={(e) => {
                e.stopPropagation();
                onPick(i);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                i === highlight
                  ? 'bg-brand-50 dark:bg-brand-500/15'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <GlyphDisc
                size={22}
                aria-hidden
                className={`bg-brand-500 text-[9px] font-semibold text-white ${SOLID_BRAND_DARK}`}
              >
                {initialsOf(c.name)}
              </GlyphDisc>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
                  {c.name}
                </span>
                <span className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
                  @{c.handle}
                </span>
              </span>
              {c.pending ? (
                <Chip className="bg-amber-100 px-1.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  Invited
                </Chip>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
