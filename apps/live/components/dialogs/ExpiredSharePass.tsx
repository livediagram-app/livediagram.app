import { TrashIcon } from '@/components/primitives/explorer-icons';
import { Button, HoverCard } from '@livediagram/ui';
import type { ShareLink } from '@/lib/api-client';
import { SharePassTicket } from './SharePassTicket';
import { EXPIRY_LABELS } from './share-dialog-parts';

// One EXPIRED share link (docs/specs/013-workspace/share-link-expiry.md): the same pass, greyed,
// with its URL struck through, an Expired stamp, and Extend + Delete in place
// of the hand-over actions (it no longer works, so there's nothing to hand over).
export function ExpiredSharePass({
  link,
  busy,
  shareUrlFor,
  onExtend,
  onDelete,
}: {
  link: ShareLink;
  busy: boolean;
  shareUrlFor: (code: string) => string;
  onExtend: (code: string) => void;
  onDelete: (code: string) => void;
}) {
  const duration = link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry];
  return (
    <SharePassTicket role={link.role} expired>
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 -rotate-3 items-center rounded border-2 border-rose-400 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:border-rose-500/70 dark:text-rose-300">
          <span className="text-optical-line text-optical-caps uppercase tracking-widest">
            Expired
          </span>
        </span>
        <input
          readOnly
          value={shareUrlFor(link.code)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Expired pass link"
          className="min-w-0 flex-1 truncate bg-transparent px-1 py-0.5 font-mono text-[11px] text-slate-400 line-through outline-none"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <HoverCard
          title={`Extend ${duration}`}
          description="Reactivates this pass for another round of the lifetime chosen when it was issued, counted from now."
        >
          <Button
            variant="secondary"
            size="xs"
            onClick={() => onExtend(link.code)}
            disabled={busy}
            className="whitespace-nowrap"
          >
            {`Extend ${duration}`.trim()}
          </Button>
        </HoverCard>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onDelete(link.code)}
          disabled={busy}
          aria-label="Delete expired link"
          className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <TrashIcon />
        </button>
      </div>
    </SharePassTicket>
  );
}
