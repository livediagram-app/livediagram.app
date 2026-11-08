'use client';

import { useMemo, useState } from 'react';
import { Button, Chip } from '@liveworkspace/ui';
import {
  orderedTopics,
  splitTopic,
  type App,
  type Webhook,
  type WebhookTopic,
} from '@liveworkspace/index-client';
import { BUTTON, ErrorNote } from '../account-ui';
import { useAccountPanelsHost } from '../host';
import { AppName } from './marks';
import { countChosen, EventControls, EventPicker, TEXT_BUTTON } from './pickers';
import {
  appEventCount,
  attempt,
  eventName,
  eventsByApp,
  topicsOfApps,
  webhookError,
} from './webhooks-api';

// A webhook's Sends (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks): one line per app it sends for,
// the app's logo and wordmark then its events as small labels ("Every Event" when it sends all of that app's), kept
// to the apps the card covers (on This App, that app's, with a count of the rest), and Edit Events, which opens the
// add form's event picker in place. Saving sends the whole list: the shown apps' choice and every other app's
// events as they were.

const CHIP =
  'bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';

export function WebhookEvents({
  webhook,
  apps,
  onChanged,
}: {
  webhook: Webhook;
  // The apps the card covers.
  apps: readonly App[];
  onChanged: (webhook: Webhook) => void;
}) {
  const [editing, setEditing] = useState(false);
  const byApp = useMemo(() => eventsByApp(webhook.events), [webhook.events]);
  let others = 0;
  for (const [app, events] of byApp) if (!apps.includes(app)) others += events.length;
  const shown = apps.filter((app) => byApp.has(app));

  return (
    <div className="flex flex-col gap-2" aria-label="What it sends" role="group">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Sends
        </span>
        {!editing ? (
          <button
            type="button"
            className={TEXT_BUTTON}
            aria-expanded={false}
            onClick={() => setEditing(true)}
          >
            Edit Events
          </button>
        ) : null}
      </div>
      {editing ? (
        <EventsEditor
          webhook={webhook}
          apps={apps}
          onDone={(next) => {
            setEditing(false);
            if (next) onChanged(next);
          }}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((app) => {
            const events = byApp.get(app)!;
            return (
              <li key={app} data-sends-app={app} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex shrink-0 items-center">
                  <AppName app={app} />
                </span>
                {events.length === appEventCount(app) ? (
                  <Chip radius="sm" className={CHIP}>
                    Every Event
                  </Chip>
                ) : (
                  events.map((event) => (
                    <Chip key={event} radius="sm" className={CHIP}>
                      {eventName(app, event)}
                    </Chip>
                  ))
                )}
              </li>
            );
          })}
          {others > 0 ? (
            <li className="text-xs text-slate-500 dark:text-slate-400">
              {shown.length > 0 ? 'And ' : ''}
              {others === 1 ? '1 event' : `${others} events`} in other apps, shown in All.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function EventsEditor({
  webhook,
  apps,
  onDone,
}: {
  webhook: Webhook;
  apps: readonly App[];
  // The saved webhook, or nothing for Cancel.
  onDone: (webhook: Webhook | null) => void;
}) {
  const { index } = useAccountPanelsHost();
  const offered = useMemo(() => topicsOfApps(apps), [apps]);
  const [draft, setDraft] = useState<Set<WebhookTopic>>(() => new Set(webhook.events));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every other app's events, kept as they were.
  const kept = webhook.events.filter((topic) => !apps.includes(splitTopic(topic).app));
  const chosen = countChosen(offered, draft);
  const next = orderedTopics([...kept, ...offered.filter((topic) => draft.has(topic))]);
  const unchanged =
    next.length === webhook.events.length && next.every((t, i) => t === webhook.events[i]);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await attempt(() => index.updateWebhook(webhook.id, { events: next }));
    setBusy(false);
    if (result.ok) onDone(result.data.webhook);
    else setError(result.error);
  }

  return (
    <div
      data-events-editor=""
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">What Should It Send?</p>
        <EventControls topics={offered} value={draft} onChange={setDraft} />
      </div>
      <EventPicker apps={apps} value={draft} onChange={setDraft} />
      {error ? <ErrorNote>{webhookError(error, webhook.kind)}</ErrorNote> : null}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p
          aria-live="polite"
          className="mr-auto text-xs text-slate-500 empty:hidden dark:text-slate-400"
        >
          {next.length === 0
            ? 'Pick at least one thing to send.'
            : chosen === 0 && apps.length === 1
              ? 'It keeps sending other apps’ events, and moves to All.'
              : ''}
        </p>
        <button type="button" className={BUTTON.secondary} onClick={() => onDone(null)}>
          Cancel
        </button>
        <Button
          variant="none"
          className={BUTTON.primary}
          disabled={next.length === 0 || unchanged}
          busy={busy}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
