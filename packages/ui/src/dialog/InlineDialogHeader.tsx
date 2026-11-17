import type { ReactNode } from 'react';

// A dialog's header drawn inside Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool inside
// Tools"): the back bar above it names the tool and closes it, so the title is for screen readers alone (still the
// dialog's label) and what shows is the header's one line and its actions, in a slim row. Only the heading when it has
// neither.
export function InlineDialogHeader({
  titleId,
  title,
  subtitle,
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
  if (!subtitle && !actions) return heading;
  return (
    <div
      data-dialog-inline-header=""
      className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 pb-3 pt-0.5 dark:border-slate-800"
    >
      {heading}
      {subtitle ? (
        <p className="min-w-0 flex-1 text-[13px] leading-[18px] text-slate-600 dark:text-slate-400">
          {subtitle}
        </p>
      ) : (
        <span className="flex-1" />
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
