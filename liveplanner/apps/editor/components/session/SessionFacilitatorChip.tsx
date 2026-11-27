'use client';

// The facilitator chip in a Session tab's header (docs/specs/026-plan/session-tabs.md "Facilitator"): who holds the
// baton, and this screen's verb on it: Facilitate when nobody does, Take Over once the facilitator has been away, and
// for the facilitator a menu with Hand Over (to an Editor in the room) and Step Down. A Participant or Viewer sees who
// holds it, never a verb.
import { useId, useState } from 'react';
import { ResponsivePopover } from '@liveworkspace/ui';
import type { SessionBaton } from './useSessionFacilitator';

const chip =
  'inline-flex h-8 max-w-full cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white pl-1.5 pr-3 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const verb =
  'inline-flex h-8 cursor-pointer items-center rounded-full bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';
const row =
  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
      style={{ backgroundColor: color }}
    />
  );
}

export function SessionFacilitatorChip({ baton }: { baton: SessionBaton }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const { holder } = baton;
  if (!holder) {
    return baton.canFacilitate ? (
      <button type="button" className={verb} onClick={baton.take}>
        Facilitate
      </button>
    ) : (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">Nobody facilitating</span>
    );
  }
  const name = baton.mine ? 'You' : holder.name;
  const label = (
    <>
      <Dot color={holder.color} />
      <span className="truncate">
        {name} {baton.mine ? 'are' : 'is'} facilitating
      </span>
    </>
  );
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {baton.mine ? (
        <>
          <button
            ref={setAnchor}
            type="button"
            className={chip}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {label}
          </button>
          <ResponsivePopover
            open={open}
            onClose={() => setOpen(false)}
            anchor={anchor}
            titleId={titleId}
            width={260}
            align="end"
          >
            <h3
              id={titleId}
              className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
            >
              Facilitator
            </h3>
            {baton.editors.length ? (
              <>
                <p className="px-2.5 pb-1 text-[12px] text-slate-500">Hand Over To</p>
                {baton.editors.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={row}
                    onClick={() => {
                      baton.handOver(e);
                      setOpen(false);
                    }}
                  >
                    <Dot color={e.color} />
                    <span className="truncate">{e.name}</span>
                  </button>
                ))}
              </>
            ) : (
              <p className="px-2.5 py-1.5 text-[12px] text-slate-500">
                No other Editor is here to hand over to.
              </p>
            )}
            <button
              type="button"
              className={`${row} mt-1 border-t border-slate-100 pt-2.5 dark:border-slate-800`}
              onClick={() => {
                baton.stepDown();
                setOpen(false);
              }}
            >
              Step Down
            </button>
          </ResponsivePopover>
        </>
      ) : (
        <span className={`${chip} cursor-default hover:bg-white dark:hover:bg-slate-900`}>
          {label}
        </span>
      )}
      {baton.canTakeOver ? (
        <button type="button" className={verb} onClick={baton.take}>
          Take Over
        </button>
      ) : null}
    </span>
  );
}
