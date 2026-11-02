import { CompactEmptyState } from '@liveworkspace/ui';
import { dateFormat } from '@liveworkspace/ui/date-format';
import { SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import type { WebhookDelivery, WebhookEvent } from '@liveworkspace/index-client';
import { AppName, DeliveredGlyph, FailedGlyph, WaitingGlyph } from './marks';
import { deliveryLine, EVENT_APP, eventName } from './webhooks-api';

// A webhook's Recent Deliveries (webhooks.md "Delivery"): newest first, each its event and item, what happened in
// words, how many tries, and when, marked green, red or amber.

// In the reader's locale, made once (@liveworkspace/ui/date-format).
const TIME = dateFormat({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const MARKS: Record<WebhookDelivery['state'], { Glyph: typeof DeliveredGlyph; tone: string }> = {
  delivered: { Glyph: DeliveredGlyph, tone: 'text-emerald-600 dark:text-emerald-400' },
  failed: { Glyph: FailedGlyph, tone: 'text-rose-600 dark:text-rose-400' },
  pending: { Glyph: WaitingGlyph, tone: 'text-amber-600 dark:text-amber-400' },
};

export function Deliveries({ deliveries }: { deliveries: WebhookDelivery[] | null }) {
  if (deliveries === null)
    return (
      <div aria-busy className="flex flex-col gap-2 py-1">
        {[0, 1].map((n) => (
          <div
            key={n}
            className="h-9 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-700/50"
          />
        ))}
      </div>
    );
  if (deliveries.length === 0)
    return (
      <CompactEmptyState
        size="small"
        icon={<SettingsSharedGlyph id="webhooks" />}
        title="No Deliveries Yet"
        description="Send a test to try it, or wait for something to happen to the items it watches."
      />
    );
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60 text-sm dark:divide-slate-700/70 dark:border-slate-700 dark:bg-slate-900/30">
      {deliveries.map((d) => {
        const { Glyph, tone } = MARKS[d.state];
        const app = EVENT_APP[d.type as WebhookEvent];
        const at = d.lastAttemptAt ?? d.occurredAt;
        return (
          <li key={d.id} data-delivery={d.state} className="flex items-start gap-2.5 px-3 py-2.5">
            <span className={`mt-0.5 shrink-0 ${tone}`}>
              <Glyph />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-slate-900 dark:text-white">
                <span className="font-medium">{eventName(d.type)}</span>
                {app ? <AppName app={app} /> : null}
                {d.type !== 'ping' ? (
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                    · {d.title}
                  </span>
                ) : null}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {deliveryLine(d)}
                {d.attempts > 1 ? ` · ${d.attempts} tries` : ''}
              </span>
            </span>
            <time
              dateTime={new Date(at).toISOString()}
              className="shrink-0 pt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400"
            >
              {TIME.format(at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
