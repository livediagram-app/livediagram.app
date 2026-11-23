'use client';

// A card's long list on Insights (docs/specs/030-knowledgebase/blueprints/insights-ui.md "Caps"): the rows
// past the cap are not drawn until Show All is pressed, so the dashboard never grows with the data.
import { useCallback, useState } from 'react';
import { Button } from '@liveknowledge/ui';

export function useShowAll<T>(rows: readonly T[], cap: number) {
  const [open, setOpen] = useState(false);
  const capped = rows.length > cap;
  const fold = useCallback(() => setOpen(false), []);
  return {
    shown: capped && !open ? rows.slice(0, cap) : rows,
    toggle: capped ? (
      <ShowAllButton count={rows.length} open={open} onToggle={() => setOpen((was) => !was)} />
    ) : null,
    fold,
  };
}

function ShowAllButton({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-2 flex justify-center border-t border-slate-100 pt-2 dark:border-slate-800">
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={open}
        onClick={onToggle}
        className="cursor-pointer phone:min-h-11"
      >
        {open ? 'Show Fewer' : `Show All ${count.toLocaleString('en')}`}
      </Button>
    </div>
  );
}
