'use client';

// The picked app's own steps (docs/specs/030-knowledgebase/mcp-connect.md "The view" 2): the Build with AI page's
// words, its bold menu names (StepText) and its code panels with Copy (CodeSnippet), from
// @liveworkspace/marketing-site, so the two never tell a person different things.
import { CodeSnippet } from '@liveworkspace/marketing-site/components/ai/CodeSnippet';
import { StepText } from '@liveworkspace/marketing-site/components/ai/StepText';
import { lucideExternalLink } from '@liveworkspace/icons/lucide';
import { buttonClassName, lucideGlyph } from '@liveknowledge/ui';
import type { ConnectApp } from '@/lib/knowledge-connect/connect-apps';
import { track } from '@/lib/telemetry';
import { INSIGHTS_MUTED } from '@/components/insights/InsightsSection';

const ExternalIcon = lucideGlyph(lucideExternalLink, 14);

const copied = () => track('UI', 'Copied', 'McpSetup');

export function AppSteps({ app }: { app: ConnectApp }) {
  return (
    <div data-connect-app-steps={app.id}>
      <ol className="flex flex-col gap-4">
        {app.steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5">
            <span
              aria-hidden
              className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="text-optical-centre">{i + 1}</span>
            </span>
            <div className="flex min-w-0 flex-col gap-2.5 pt-0.5">
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                <StepText text={step.text} />
              </p>
              {step.action ? (
                <a
                  href={step.action.href}
                  {...(step.action.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className={buttonClassName({
                    variant: 'secondary',
                    size: 'sm',
                    className: 'w-fit cursor-pointer phone:min-h-11',
                  })}
                >
                  {step.action.label}
                  {step.action.external ? (
                    <>
                      <ExternalIcon aria-hidden />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </>
                  ) : null}
                </a>
              ) : null}
              {step.code ? (
                <CodeSnippet
                  code={step.code.code}
                  lang={step.code.lang}
                  label={step.code.label}
                  onCopied={copied}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {app.note ? (
        <p
          className={`mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] leading-5 dark:bg-slate-800/60 ${INSIGHTS_MUTED}`}
        >
          {app.note}
        </p>
      ) : null}
    </div>
  );
}
