'use client';

import { useState } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import { AccordionSection, SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import {
  WEBHOOK_EVENT_LABELS,
  type Webhook,
  type WebhookDelivery,
} from '@liveworkspace/index-client';
import { formatDate } from '@/lib/account-api';
import { BUTTON, ErrorNote, Panel } from '../account-ui';
import { ConfirmAction } from '../ConfirmAction';
import {
  attempt,
  deliveryLine,
  deliveryTypeLabel,
  KIND_LABELS,
  stateOf,
  webhookError,
  webhooksClient,
} from './webhooks-api';

const PILL = 'rounded-full px-2 py-0.5 text-xs font-medium';
const TONES = {
  live: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  paused: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
};
const DELIVERY_TONES: Record<WebhookDelivery['state'], string> = {
  delivered: 'bg-emerald-500',
  failed: 'bg-rose-500',
  pending: 'bg-amber-400',
};

const TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// One webhook (webhooks.md "Settings"): what it is and where it sends (the host alone; the URL never comes back), its
// state, Send Test, Pause or Resume, Delete, and its recent deliveries, read when that section is opened.
export function WebhookRow({
  webhook,
  scopeName,
  onChanged,
  onDeleted,
}: {
  webhook: Webhook;
  // "Your own items", or the team's.
  scopeName: string;
  onChanged: (webhook: Webhook) => void;
  onDeleted: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const state = stateOf(webhook);
  const paused = webhook.pausedAt !== null;

  async function run<T>(call: () => Promise<T>, done: (data: T) => void) {
    setBusy(true);
    setError(null);
    setNote(null);
    const result = await attempt(call);
    setBusy(false);
    if (result.ok) done(result.data);
    else setError(result.error);
  }

  const loadDeliveries = () =>
    run(
      () => webhooksClient.webhookDeliveries(webhook.id),
      (data) => setDeliveries(data.deliveries),
    );

  const last = webhook.lastDelivery;
  const lastLine = last
    ? `${last.state === 'delivered' ? 'Last delivered' : 'Last failed'} ${formatDate(last.at)}`
    : 'Nothing sent yet';

  return (
    <li data-webhook={webhook.id}>
      <Panel>
        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <span className="min-w-0 truncate">{webhook.name}</span>
          <span className={`${PILL} ${TONES.paused}`}>{KIND_LABELS[webhook.kind]}</span>
          <span className={`${PILL} ${TONES[state.tone]}`}>{state.label}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {scopeName} ·{' '}
          <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{webhook.host}</span> ·{' '}
          {lastLine}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {webhook.events.map((e) => WEBHOOK_EVENT_LABELS[e]).join(', ')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={BUTTON.secondary}
            disabled={busy || paused}
            onClick={() =>
              void run(
                () => webhooksClient.testWebhook(webhook.id),
                () => {
                  setNote('Test sent. It shows in Recent Deliveries in a moment.');
                  if (open) void loadDeliveries();
                },
              )
            }
          >
            Send Test
          </button>
          <button
            type="button"
            className={BUTTON.secondary}
            disabled={busy}
            onClick={() =>
              void run(
                () => webhooksClient.updateWebhook(webhook.id, { paused: !paused }),
                (data) => onChanged(data.webhook),
              )
            }
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <span className="ml-auto">
            <ConfirmAction
              label="Delete"
              confirmLabel="Delete now"
              onConfirm={() =>
                run(
                  () => webhooksClient.deleteWebhook(webhook.id),
                  () => void onDeleted(),
                )
              }
            />
          </span>
        </div>
        {note && (
          <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {note}
          </p>
        )}
        {error && <ErrorNote>{webhookError(error, webhook.kind)}</ErrorNote>}
        <div className="mt-3 border-t border-slate-100 pt-1 dark:border-slate-800">
          <AccordionSection
            title="Recent Deliveries"
            open={open}
            onToggle={() => {
              const next = !open;
              setOpen(next);
              if (next) void loadDeliveries();
            }}
          >
            <Deliveries deliveries={deliveries} />
          </AccordionSection>
        </div>
      </Panel>
    </li>
  );
}

function Deliveries({ deliveries }: { deliveries: WebhookDelivery[] | null }) {
  if (deliveries === null)
    return (
      <div
        aria-busy
        className="h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
      />
    );
  if (deliveries.length === 0)
    return (
      <CompactEmptyState
        size="small"
        icon={<SettingsSharedGlyph id="webhooks" />}
        title="No deliveries yet"
        description="Send Test to try it, or wait for something to happen."
      />
    );
  return (
    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
      {deliveries.map((d) => (
        <li key={d.id} className="flex items-start gap-2 py-2">
          <span
            aria-hidden
            className={`mt-1.5 size-2 shrink-0 rounded-full ${DELIVERY_TONES[d.state]}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-slate-900 dark:text-white">
              {deliveryTypeLabel(d)}: {d.title}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {deliveryLine(d)}
              {d.attempts > 1 ? ` · ${d.attempts} tries` : ''}
            </span>
          </span>
          <time
            dateTime={new Date(d.lastAttemptAt ?? d.occurredAt).toISOString()}
            className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400"
          >
            {TIME.format(d.lastAttemptAt ?? d.occurredAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
