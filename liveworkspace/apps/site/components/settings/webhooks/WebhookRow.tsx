'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Chip, ConfirmPopover, Tooltip, TrashIcon } from '@liveworkspace/ui';
import { AccordionSection } from '@liveworkspace/settings-ui';
import {
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookDelivery,
  type WebhookKind,
} from '@liveworkspace/index-client';
import { BUTTON, ErrorNote } from '../account-ui';
import { Deliveries } from './Deliveries';
import {
  AppName,
  DeliveredGlyph,
  FailedGlyph,
  KindMark,
  PauseGlyph,
  PlayGlyph,
  SendGlyph,
  WaitingGlyph,
} from './marks';
import { useSendTest, type TestResult } from './useSendTest';
import {
  attempt,
  EVENT_APP,
  eventName,
  failureOf,
  KINDS,
  stateOf,
  webhookError,
  webhooksClient,
  whenOf,
  type WebhookTone,
} from './webhooks-api';

// One webhook (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks): its destination's mark, its name and
// state, whose items it reports on and where it posts (the host alone; the URL never comes back), its last delivery,
// Send Test with the test's result read back, Pause or Resume, Delete (asked in a popover), the events it sends, and
// its Recent Deliveries, read when that section is first opened.

const BADGES: Record<WebhookTone, { chip: string; dot: string }> = {
  live: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dot: 'bg-emerald-500',
  },
  paused: {
    chip: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-400/20',
    dot: 'bg-slate-400',
  },
  warn: {
    chip: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    dot: 'bg-amber-500',
  },
};

const NOTES = {
  slate:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  amber:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
} as const;

// A line under the row's head, with a mark, the words, and a button where there's something to do.
function Note({
  tone,
  icon,
  action,
  status = false,
  children,
}: {
  tone: keyof typeof NOTES;
  icon: ReactNode;
  action?: ReactNode;
  // A test's result, which a screen reader hears as it changes.
  status?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={status ? 'status' : undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 text-sm ${NOTES[tone]}`}
    >
      <span className="flex min-w-0 flex-1 basis-56 items-start gap-2">
        <span className="mt-0.5 shrink-0 opacity-80">{icon}</span>
        <span className="min-w-0">{children}</span>
      </span>
      {action}
    </div>
  );
}

// What a test's result says, by where the webhook posts.
function TestNote({ kind, result }: { kind: WebhookKind; result: TestResult }) {
  switch (result.state) {
    case 'sending':
      return (
        <Note tone="slate" icon={<WaitingGlyph />} status>
          Sending a test…
        </Note>
      );
    case 'delivered':
      return (
        <Note tone="emerald" icon={<DeliveredGlyph />} status>
          {kind === 'json'
            ? `Test delivered. Your service answered ${result.status ?? 'with success'}.`
            : `Test delivered. Look for it in your ${KINDS[kind].label} channel.`}
        </Note>
      );
    case 'failed':
      return (
        <Note tone="rose" icon={<FailedGlyph />} status>
          The test didn’t arrive: {failureOf(result.delivery) ?? 'it failed'}. Check the address,
          then try again.
        </Note>
      );
    case 'queued':
      return (
        <Note tone="slate" icon={<WaitingGlyph />} status>
          Test queued. It shows in Recent Deliveries once it’s sent.
        </Note>
      );
    case 'refused':
      return <ErrorNote>{webhookError(result.error, kind)}</ErrorNote>;
  }
}

export function WebhookRow({
  webhook,
  scopeName,
  fresh = false,
  now,
  onChanged,
  onDeleted,
}: {
  webhook: Webhook;
  // "Your own items", or the team's.
  scopeName: string;
  // Just added: a line inviting a test.
  fresh?: boolean;
  // The moment the list was read, so every row's "2 hours ago" agrees.
  now: number;
  onChanged: (webhook: Webhook) => void;
  onDeleted: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [confirming, setConfirming] = useState<HTMLElement | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const test = useSendTest(webhook.id, setDeliveries);
  const state = stateOf(webhook);
  const paused = webhook.pausedAt !== null;
  const kind = KINDS[webhook.kind];

  async function run<T>(call: () => Promise<T>, done: (data: T) => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await attempt(call);
    setBusy(false);
    if (result.ok) done(result.data);
    else setError(result.error);
  }

  const setPaused = (next: boolean) =>
    run(
      () => webhooksClient.updateWebhook(webhook.id, { paused: next }),
      (data) => {
        test.clear();
        onChanged(data.webhook);
      },
    );

  const toggleDeliveries = () => {
    const next = !open;
    setOpen(next);
    if (next)
      void run(
        () => webhooksClient.webhookDeliveries(webhook.id),
        (data) => setDeliveries(data.deliveries),
      );
  };

  const pauseLabel = paused ? 'Resume Webhook' : 'Pause Webhook';
  const resume = (
    <button
      type="button"
      className={`${BUTTON.secondary} !px-3 !py-1.5 bg-white dark:bg-slate-800`}
      aria-disabled={busy || undefined}
      // The note and this button go once it resumes: the keyboard moves to the row's Pause.
      onClick={() => void setPaused(false).then(() => pauseRef.current?.focus())}
    >
      Resume
    </button>
  );

  return (
    <li data-webhook={webhook.id} className="border-t border-slate-100 dark:border-slate-700/70">
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
          <KindMark kind={webhook.kind} />
          <div className="min-w-0 flex-1 basis-52">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h5 className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">
                <bdi>{webhook.name}</bdi>
              </h5>
              <Chip
                data-state={state.tone}
                icon={
                  <span aria-hidden className={`size-1.5 rounded-full ${BADGES[state.tone].dot}`} />
                }
                className={`px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGES[state.tone].chip}`}
              >
                {state.label}
              </Chip>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {kind.label} · {scopeName}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {/* The host whole, never split at a hyphen: a long one ends in an ellipsis. */}
              <span className="min-w-0 max-w-full truncate font-mono text-slate-500 dark:text-slate-400">
                {webhook.host}
              </span>
              <LastDelivery webhook={webhook} now={now} />
            </div>
          </div>
          <div className="ml-[52px] flex shrink-0 items-center gap-1.5 sm:ml-0">
            <button
              type="button"
              className={`${BUTTON.secondary} gap-1.5 !px-3.5`}
              // Paused, it can't be pressed. While a test sends, or the row is busy, it stays focusable
              // (aria-disabled, and a press does nothing): disabling the focused button dropped the keyboard
              // out of Settings altogether.
              disabled={paused}
              aria-disabled={busy || test.result?.state === 'sending' || undefined}
              onClick={() => {
                if (busy || test.result?.state === 'sending') return;
                setError(null);
                void test.send();
              }}
            >
              <SendGlyph />
              Send Test
            </button>
            <Tooltip label={pauseLabel}>
              <button
                ref={pauseRef}
                type="button"
                aria-label={pauseLabel}
                className={BUTTON.icon}
                // Focusable while it saves, so the keyboard stays on it as it turns into Resume (or Pause).
                aria-disabled={busy || undefined}
                onClick={() => void setPaused(!paused)}
              >
                {paused ? <PlayGlyph /> : <PauseGlyph />}
              </button>
            </Tooltip>
            <Tooltip label="Delete Webhook">
              <button
                ref={deleteRef}
                type="button"
                aria-label="Delete Webhook"
                aria-haspopup="dialog"
                className={BUTTON.iconDanger}
                disabled={busy}
                onClick={(event) => setConfirming(event.currentTarget)}
              >
                <TrashIcon size={15} />
              </button>
            </Tooltip>
          </div>
        </div>

        {state.note ? (
          <Note tone="amber" icon={<FailedGlyph />} action={resume}>
            {state.note}
          </Note>
        ) : paused ? (
          <Note tone="slate" icon={<PauseGlyph />} action={resume}>
            Paused. Nothing is sent until you resume it.
          </Note>
        ) : null}
        {test.result ? (
          <TestNote kind={webhook.kind} result={test.result} />
        ) : fresh && !paused ? (
          <Note tone="emerald" icon={<DeliveredGlyph />}>
            Added. Send a test to check it reaches{' '}
            {webhook.kind === 'json' ? 'your service' : 'your channel'}.
          </Note>
        ) : null}
        {error ? <ErrorNote>{webhookError(error, webhook.kind)}</ErrorNote> : null}

        <EventChips events={webhook.events} />

        <div className="-mb-2 border-t border-slate-100 pt-1 dark:border-slate-700/70">
          <AccordionSection title="Recent Deliveries" open={open} onToggle={toggleDeliveries}>
            <Deliveries deliveries={deliveries} />
          </AccordionSection>
        </div>
      </div>
      {confirming ? (
        <ConfirmPopover
          anchor={confirming}
          message={`Delete “${webhook.name}”? It stops posting at once, and its delivery history goes with it.`}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirming(null);
            void run(
              () => webhooksClient.deleteWebhook(webhook.id),
              () => void onDeleted(),
            );
          }}
          onCancel={() => {
            setConfirming(null);
            deleteRef.current?.focus();
          }}
        />
      ) : null}
    </li>
  );
}

// The newest finished delivery, in words and colour.
function LastDelivery({ webhook, now }: { webhook: Webhook; now: number }) {
  const last = webhook.lastDelivery;
  const [Glyph, tone, words] = !last
    ? [WaitingGlyph, 'text-slate-500 dark:text-slate-400', 'Nothing sent yet']
    : last.state === 'delivered'
      ? [
          DeliveredGlyph,
          'text-emerald-700 dark:text-emerald-400',
          `Delivered ${whenOf(last.at, now)}`,
        ]
      : [
          FailedGlyph,
          'text-rose-700 dark:text-rose-400',
          `Last delivery failed ${whenOf(last.at, now)}`,
        ];
  return (
    <span className={`flex shrink-0 items-center gap-1 font-medium ${tone}`}>
      <Glyph />
      {words}
    </span>
  );
}

// The events it sends, as small labels; every one as one.
function EventChips({ events }: { events: Webhook['events'] }) {
  const chip =
    'bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="What it sends">
      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Sends
      </span>
      {events.length === WEBHOOK_EVENTS.length ? (
        <Chip radius="sm" className={chip}>
          Every Event
        </Chip>
      ) : (
        events.map((event) => {
          const app = EVENT_APP[event];
          return (
            <Chip key={event} radius="sm" className={chip}>
              {eventName(event)}
              {app ? (
                <span className="ml-1 inline-flex align-middle [&_[data-logotype]]:text-[11px] [&_svg]:size-3">
                  <AppName app={app} />
                </span>
              ) : null}
            </Chip>
          );
        })
      )}
    </div>
  );
}
