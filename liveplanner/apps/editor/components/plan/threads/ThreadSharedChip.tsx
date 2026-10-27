'use client';

// The chip on a thread that is on more than one card (docs/specs/026-plan/items.md "Where it shows"): "On 3 cards",
// opening a list of every card it is on. A card of this plan opens in the card panel; another plan's opens in a new
// tab, on the thread.

import { useState } from 'react';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideExternalLink, lucideLink } from '@liveworkspace/icons/lucide';
import type { CardThread } from '@liveplanner/project';
import {
  MenuActionRow,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { cardLabel, sharedBeyond, sharedLabel } from './thread-words';
import type { CardThreadsContextValue } from './CardThreadsContext';

const LinkIcon = lucideGlyph(lucideLink, 11);
const OutIcon = lucideGlyph(lucideExternalLink, 14);

/** Where another plan's card opens: the plan, on the card and the thread. */
export function otherPlanCardHref(projectId: string, itemId: string, threadId: string): string {
  return `/project/${encodeURIComponent(projectId)}#item=${encodeURIComponent(itemId)}&thread=${encodeURIComponent(threadId)}`;
}

export function ThreadSharedChip({
  thread,
  itemId,
  ctx,
  titleOf,
}: {
  thread: CardThread;
  itemId: string;
  ctx: CardThreadsContextValue;
  titleOf: (itemId: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const beyond = sharedBeyond(thread, ctx.projectId);
  return (
    <>
      <Tooltip label={sharedLabel(thread.cards.length)}>
      <button
        ref={setButton}
        type="button"
        data-thread-shared=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${sharedLabel(thread.cards.length)}${beyond ? ', some in other plans' : ''}: show them`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium transition motion-reduce:transition-none pointer-coarse:h-8 ${
          beyond
            ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        <LinkIcon aria-hidden />
        {thread.cards.length}
      </button>
      </Tooltip>
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuHeader title={sharedLabel(thread.cards.length)} />
          {thread.cards.map((card) => {
            const here = card.projectId === ctx.projectId;
            const current = here && card.itemId === itemId;
            return (
              <MenuActionRow
                key={`${card.projectId}:${card.itemId}`}
                plain
                label={`${cardLabel(card, ctx.projectId, titleOf)}${current ? ' (this card)' : ''}`}
                icon={here ? <LinkIcon /> : <OutIcon />}
                disabled={current}
                onClick={() => {
                  setOpen(false);
                  if (here) ctx.openCard(card.itemId);
                  else
                    window.open(
                      otherPlanCardHref(card.projectId, card.itemId, thread.id),
                      '_blank',
                      'noopener',
                    );
                }}
              />
            );
          })}
        </PortalMenu>
      ) : null}
    </>
  );
}
