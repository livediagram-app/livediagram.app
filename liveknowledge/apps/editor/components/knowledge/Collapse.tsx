// A disclosure's body that opens and closes by sliding its height (owner 2026-11-22: Score Breakdown and Page Details
// animate both ways). The row track runs from 0fr to 1fr, so no height is measured; reduced motion snaps. Closed, the
// body is inert: out of the tab order and hidden from a screen reader.
import type { ReactNode } from 'react';

export function Collapse({
  open,
  id,
  children,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      inert={!open}
      aria-hidden={!open || undefined}
      data-collapse={open ? 'open' : 'closed'}
      className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
