// One numbered step of Connect (docs/specs/030-knowledgebase/mcp-connect.md "The view"): a card named by its
// heading, the step's number in a brand circle beside it (the list it sits in counts for a screen reader), one line
// about it, then its body. The card is Insights' (AiSection), so the two views read alike.
import { useId, type ReactNode } from 'react';
import { AI_CARD, AI_MUTED } from '@/components/ai-knowledge/AiSection';

export function ConnectStep({
  n,
  title,
  about,
  step,
  children,
}: {
  n: number;
  title: string;
  about: ReactNode;
  // The step's mark for tests and the browser check.
  step: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <li className="list-none">
      <section
        aria-labelledby={id}
        data-connect-step={step}
        className={`${AI_CARD} min-w-0 p-4 sm:p-5`}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white dark:bg-brand-500 dark:text-slate-950"
          >
            <span className="text-optical-centre">{n}</span>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={id}
              className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            <p className={`mt-1 text-[13px] leading-5 ${AI_MUTED}`}>{about}</p>
          </div>
        </div>
        <div className="mt-4 sm:pl-11">{children}</div>
      </section>
    </li>
  );
}
