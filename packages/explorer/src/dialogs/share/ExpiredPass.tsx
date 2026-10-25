'use client';

// One expired share link: the same pass, greyed, its address struck through under an Expired stamp, with Extend
// and Delete in place of the hand-over buttons, since it no longer opens anything.

import type { ShareLink } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { TrashIcon } from '../../ui/icons';
import { PassTicket, usePassExit } from './PassTicket';
import { LIFETIMES, PASS_BIN } from './parts';

export function ExpiredPass({
  link,
  url,
  busy,
  onExtend,
  onDelete,
}: {
  link: ShareLink;
  url: string;
  busy: boolean;
  onExtend: () => void;
  onDelete: () => void;
}) {
  const exit = usePassExit(onDelete);
  const extend = link.expiry === 'never' ? 'Extend' : `Extend ${LIFETIMES[link.expiry]}`;
  return (
    <PassTicket level={link.level} code={link.code} expired leaving={exit.leaving}>
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 -rotate-3 items-center rounded border-2 border-rose-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:border-rose-500/70 dark:text-rose-300">
          Expired
        </span>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Expired pass link"
          className="min-w-0 flex-1 truncate bg-transparent px-1 py-0.5 font-mono text-[11px] text-slate-500 line-through outline-none dark:text-slate-400"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="xs"
          onClick={onExtend}
          disabled={busy}
          title="Opens it again for another round of the lifetime it was issued with, counted from now."
          className="whitespace-nowrap"
        >
          {extend}
        </Button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={exit.leave}
          disabled={busy || exit.leaving}
          aria-label="Delete expired link"
          className={PASS_BIN}
        >
          <TrashIcon />
        </button>
      </div>
    </PassTicket>
  );
}
