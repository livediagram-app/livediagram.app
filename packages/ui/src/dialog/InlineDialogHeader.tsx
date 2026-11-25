import type { ReactNode } from 'react';

// A dialog's header drawn inside Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool inside
// Tools"): Tools' band above it names the tool, carries its row's line and backs out of it. So the title is no heading
// here (the band's is the one heading, and a screen reader would hear the name twice): a hidden label that keeps the
// dialog's accessible name. Its one line is left out too (owner, 2026-11-17: the tool explains itself below, better);
// only its actions show, in a slim row. Only the label when it has none.
export function InlineDialogHeader({
  titleId,
  title,
  // Accepted from the full header and not drawn here.
  subtitle: _subtitle,
  actions,
}: {
  titleId?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  // `hidden`: out of the reading order and the heading list, still read by aria-labelledby.
  const heading = titleId ? (
    <span id={titleId} hidden>
      {title}
    </span>
  ) : null;
  if (!actions) return heading;
  return (
    <div data-dialog-inline-header="" className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-0.5">
      {heading}
      <span className="flex-1" />
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
