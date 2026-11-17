import type { ReactNode } from 'react';

// A dialog's header drawn inside Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool inside
// Tools"): the back bar above it names the tool and closes it, so the title is for screen readers alone (still the
// dialog's label). Its one line is left out too (owner, 2026-11-17: the tool explains itself below, better); only its
// actions show, in a slim row. Only the heading when it has none.
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
  const heading = (
    <h2 id={titleId} className="sr-only">
      {title}
    </h2>
  );
  if (!actions) return heading;
  return (
    <div data-dialog-inline-header="" className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-0.5">
      {heading}
      <span className="flex-1" />
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
