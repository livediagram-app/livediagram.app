'use client';

// The chip on a thread that is on more than one card (docs/specs/026-plan/items.md "Where it shows"): "On 3 cards",
// opening a list of every card it is on. A card of this plan opens in the card panel; another plan's opens in a new
// tab, on the thread.

import { useState } from 'react';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideExternalLink, lucideLink } from '@liveworkspace/icons/lucide';
import type { CardRef, CardThread } from '@liveplanner/project';
import { MenuHeader, PortalMenu } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useMenuItemProps } from '@liveworkspace/workbench/components/primitives/menu-item-props';
import { sharedBeyond, sharedLabel } from './thread-words';
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
          <span className="text-optical-centre">{thread.cards.length}</span>
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuHeader title={sharedLabel(thread.cards.length)} />
          <div className="w-72 max-w-[calc(100vw-2rem)] pb-1">
            {thread.cards.map((card) => (
              <SharedCardRow
                key={`${card.projectId}:${card.itemId}`}
                card={card}
                here={card.projectId === ctx.projectId}
                current={card.projectId === ctx.projectId && card.itemId === itemId}
                title={card.projectId === ctx.projectId ? titleOf(card.itemId) : null}
                onOpen={() => {
                  setOpen(false);
                  if (card.projectId === ctx.projectId) ctx.openCard(card.itemId);
                  else
                    window.open(
                      otherPlanCardHref(card.projectId, card.itemId, thread.id),
                      '_blank',
                      'noopener',
                    );
                }}
              />
            ))}
          </div>
        </PortalMenu>
      ) : null}
    </>
  );
}

// One card the thread is on: its number, its title (or, in another plan, that plan's name) and where it opens.
function SharedCardRow({
  card,
  here,
  current,
  title,
  onOpen,
}: {
  card: CardRef;
  here: boolean;
  current: boolean;
  title: string | null;
  onOpen: () => void;
}) {
  const { itemProps } = useMenuItemProps({ disabled: current });
  const num = card.key !== null ? `#${card.key}` : 'A card';
  const name = here ? title || 'Untitled' : card.projectName || 'Another plan';
  return (
    <button
      type="button"
      {...itemProps}
      disabled={current}
      onClick={onOpen}
      aria-label={`${num} ${here ? name : `in ${name}`}${current ? ', this card' : here ? '' : ', opens in a new tab'}`}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-transparent motion-reduce:transition-none pointer-coarse:py-3 dark:hover:bg-slate-800"
    >
      <span aria-hidden className="shrink-0 text-slate-400">
        {here ? <LinkIcon /> : <OutIcon />}
      </span>
      <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
        {num}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-slate-800 dark:text-slate-100">
          {here ? name : `in ${name}`}
        </span>
      </span>
      {current ? (
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          This card
        </span>
      ) : null}
    </button>
  );
}
