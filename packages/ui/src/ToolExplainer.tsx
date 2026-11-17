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
