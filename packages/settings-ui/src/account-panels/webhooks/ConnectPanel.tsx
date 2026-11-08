import type { ReactNode } from 'react';
import { GlyphDisc } from '@liveworkspace/ui';
import type { WebhookKind } from '@liveworkspace/index-client';
import { KindMark } from './marks';
import { KINDS } from './webhooks-api';

// The add form's Connect It (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks): one panel for the chosen
// destination, headed by its tile and "Connect Slack", then how to get the address as a numbered guide (each number
// in a disc, a hairline running down from one to the next), then the address field itself, so the steps and the
// box they end in read as one thing. Your Own Service has one line in place of steps.
export function ConnectPanel({
  kind,
  guideId,
  children,
}: {
  kind: WebhookKind;
  // The guide's id, for the field's aria-describedby.
  guideId: string;
  // The address field.
  children: ReactNode;
}) {
  const words = KINDS[kind];
  const service = words.steps.length === 1;
  return (
    <div
      data-connect={kind}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/30">
        <KindMark kind={kind} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {service ? 'Connect Your Service' : `Connect ${words.label}`}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {service ? 'Signed JSON, posted as things happen' : `${words.blurb}, as things happen`}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        {service ? (
          <p id={guideId} className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {words.steps[0]}
          </p>
        ) : (
          <ol id={guideId} aria-label={`How to get your ${words.field}`} className="flex flex-col">
            {words.steps.map((text, i) => (
              <li key={text} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < words.steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[11px] top-6 w-px bg-slate-200 dark:bg-slate-700"
                  />
                ) : null}
                <GlyphDisc
                  size={22}
                  aria-hidden
                  className="relative bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                >
                  {i + 1}
                </GlyphDisc>
                <span className="min-w-0 pt-0.5 text-sm leading-snug text-slate-700 dark:text-slate-300">
                  {text}
                </span>
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </div>
  );
}
