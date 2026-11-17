// A tool's explainer (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Explainers"): where a tool screen has
// little to show yet (nothing set up, nothing recorded), an illustration of what the tool does, its name, a line on why
// you would use it, and up to three numbered steps, then the screen's own action. One shape in every tool, so a sparse
// screen reads as an invitation rather than an empty box. The art is the tool's own (./tool-explainer-art), drawn in
// the brand and slate ramps so it follows the theme; its motion is CSS only and stops under reduced motion.
import type { ReactNode } from 'react';

export function ToolExplainer({
  art,
  title,
  description,
  steps,
  children,
  data,
}: {
  // The tool's illustration, a 280 by 120 drawing (tool-explainer-art), drawn at 140 px tall.
  art: ReactNode;
  title: string;
  description: string;
  // How it works, in order: two or three short steps.
  steps?: readonly string[];
  // The screen's own action, under the steps.
  children?: ReactNode;
  data?: string;
}) {
  return (
    <div data-tool-explainer={data} className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/80 via-white to-white dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900">
        {/* A faint dot grid behind the art: the canvas the products share. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full text-brand-300/40 dark:text-brand-300/10"
        >
          <defs>
            <pattern id="tool-explainer-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tool-explainer-dots)" />
        </svg>
        <div className="relative flex justify-center px-5 pb-2 pt-7 [&>svg]:h-[140px] [&>svg]:w-full [&>svg]:max-w-[326px]">
          {art}
        </div>
        <div className="relative px-6 pb-6 pt-2 text-center">
          <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <p className="mx-auto mt-1.5 max-w-[22rem] text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
      </div>
      {steps && steps.length > 0 ? (
        <ol aria-label="How it works" className="flex flex-col gap-2.5 px-1">
          {steps.map((step, i) => (
            <li
              key={step}
              className="flex items-start gap-3 text-[13px] leading-snug text-slate-700 dark:text-slate-200"
            >
              <span
                aria-hidden
                className="-mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-semibold text-white dark:bg-brand-600"
              >
                <span className="text-optical-centre">{i + 1}</span>
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {children}
    </div>
  );
}

const PULSE = 'motion-safe:animate-pulse rounded bg-brand-100/70 dark:bg-slate-700/60';
const PULSE_SOFT = 'motion-safe:animate-pulse rounded bg-slate-100 dark:bg-slate-700/40';

/** A tool's explainer while the tool loads, in the explainer's own frame and size: most tools open empty, so the
 *  skeleton is the empty state's shape and nothing moves when it arrives (owner, 2026-11-17: no judder on open). */
export function ToolExplainerSkeleton({ steps = 3 }: { steps?: number }) {
  return (
    <div aria-hidden data-tool-explainer-skeleton="" className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/80 via-white to-white dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900">
        <div className="relative flex justify-center px-5 pb-2 pt-7">
          <span className={`h-[140px] w-full max-w-[326px] !rounded-xl ${PULSE}`} />
        </div>
        <div className="relative flex flex-col items-center gap-2 px-6 pb-6 pt-2">
          <span className={`h-[18px] w-36 ${PULSE}`} />
          <span className={`mt-1 h-3 w-64 max-w-full ${PULSE_SOFT}`} />
          <span className={`h-3 w-48 max-w-full ${PULSE_SOFT}`} />
        </div>
      </div>
      {steps > 0 ? (
        <div className="flex flex-col gap-2.5 px-1">
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className={`size-6 shrink-0 !rounded-full ${PULSE}`} />
              <span className={`h-3 ${PULSE_SOFT}`} style={{ width: `${[72, 58, 66][i % 3]}%` }} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A whole tool loading inside Tools: its explainer's skeleton, then the footer with a button's, pinned at the foot
 *  as the real one is. */
export function ToolSkeleton({ label, steps }: { label: string; steps?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-5 pt-4">
        <ToolExplainerSkeleton steps={steps} />
      </div>
      <div className="sticky bottom-0 mt-auto shrink-0 border-t border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <span className={`block h-9 w-full !rounded-lg ${PULSE}`} />
      </div>
    </div>
  );
}
