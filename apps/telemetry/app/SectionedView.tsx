'use client';

import { useEffect, type ReactNode } from 'react';
import { sectionId, type SectionKey } from './view-keys';

// A Detail tab that gathers several areas (docs/specs/017-telemetry/telemetry.md, "Six tabs, not
// twelve"): a row of section links, then each area under its own heading. A stack's See also asks
// for a section; the tab scrolls it in once it renders (the tab's code loads on its own, so the
// section may not exist until then).

export type ViewSection = { key: SectionKey; title: string; content: ReactNode };

// A See also that asked for a section. `n` changes on every ask, so following the same link twice
// scrolls twice.
export type SectionFocus = { section: SectionKey; n: number };

function scrollToSection(key: SectionKey): void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  document
    .getElementById(sectionId(key))
    ?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
}

export function SectionedView({
  sections,
  focus,
}: {
  sections: ViewSection[];
  focus?: SectionFocus | null;
}) {
  // Keyed on the ask alone: the sections are a fresh array every render, and a window change must
  // never pull the reader back to a section they scrolled away from.
  const asked = focus && sections.some((s) => s.key === focus.section) ? focus : null;
  useEffect(() => {
    if (asked) scrollToSection(asked.section);
  }, [asked?.section, asked?.n]); // oxlint-disable-line react/exhaustive-deps

  return (
    <div className="mt-8">
      <nav aria-label="Sections on this tab" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          On this tab
        </span>
        {sections.map((s) => (
          <a
            key={s.key}
            href={`#${sectionId(s.key)}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(s.key);
            }}
            className="touch-target-y rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
          >
            {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <section
          key={s.key}
          id={sectionId(s.key)}
          aria-labelledby={`${sectionId(s.key)}-title`}
          // Clears the sticky header and the timeframe bar fixed beneath it. The area's own intro
          // sits close under the heading, whatever margin it brings from its old tab.
          className="mt-12 scroll-mt-40 [&>h2+*]:mt-3 border-t border-slate-200 pt-8 first-of-type:border-t-0 first-of-type:pt-0 dark:border-slate-800"
        >
          <h2
            id={`${sectionId(s.key)}-title`}
            className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {s.title}
          </h2>
          {s.content}
        </section>
      ))}
    </div>
  );
}
