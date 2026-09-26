import type { ReactNode } from 'react';

/**
 * Frames an in-article illustration (docs/specs/018-help/help-app.md). Wraps an SVG scene from
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-brand-50/60 to-white p-4 shadow-sm md:p-6">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-2.5 px-1 text-center text-[13px] leading-relaxed text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
