'use client';

// What Contents says of the whole tab (livedocuments' stack: "10 cards · about 6 min"), beside its name in the
// popover's and the sheet's header, heading the list in the sidebar. Small muted figures, never a control.
export function ContentsSummary({ summary }: { summary: string }) {
  return (
    <span
      data-contents-summary=""
      className="min-w-0 truncate text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400"
    >
      {summary}
    </span>
  );
}
