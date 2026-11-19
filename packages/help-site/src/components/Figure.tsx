import type { ReactNode } from 'react';
import { isHelpScope, type HelpScope } from '@liveworkspace/help-registry';

/** Whether a figure variant shows in `scope` (liveworkspace/docs/specs/017-help/help-centre.md "Figures"): a figure
 *  with no `app` shows everywhere; `app="liveplanner"` (or a comma list) only in those apps' helps; `app="all"`
 *  only under All Apps, for the shared figure in liveworkspace's slate. A help centre with no scope shows all. */
export function figureShowsIn(app: string | undefined, scope: HelpScope | undefined): boolean {
  if (app === undefined || !scope) return true;
  const names = app.split(',').map((n) => n.trim());
  for (const name of names)
    if (!isHelpScope(name))
      throw new Error(`[help] <Figure app="${name}">: not an app id or "all"`);
  return names.includes(scope);
}

/**
 * Frames an in-article illustration (liveworkspace/docs/specs/017-help/help-centre.md). Wraps an SVG scene from
 * `components/illustrations/*` in a soft "editor viewport" card (rounded,
 * subtle border + shadow, brand-tinted backdrop) and renders an optional
 * caption beneath it. One frame for every illustration so the help centre's
 * figures read consistently; the scene itself supplies the realism.
 *
 * Registered globally in `mdx-components.tsx`, so articles only import the
 * specific scene component and drop `<Figure caption="…"><Scene/></Figure>`.
 */
export function Figure({
  children,
  caption,
  width = 'wide',
}: {
  children: ReactNode;
  caption?: ReactNode;
  /** `wide` (default) fills the column; `narrow` caps the width for small
   *  scenes like a single dialog so they don't blow up on desktop. */
  width?: 'wide' | 'narrow';
}) {
  return (
    <figure className={`my-6 ${width === 'narrow' ? 'mx-auto max-w-md' : ''}`}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50/60 to-white p-4 shadow-[0_16px_36px_-28px_rgb(30_27_75/0.4)] md:p-6 dark:border-slate-800 dark:bg-slate-900 dark:from-brand-500/10 dark:to-slate-900">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-2.5 px-1 text-center text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
