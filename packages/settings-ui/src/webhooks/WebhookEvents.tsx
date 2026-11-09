'use client';

import { useMemo, useState } from 'react';
import { Button, Chip } from '@liveworkspace/ui';
import type { Webhook, WebhookEvent, WebhookWho } from '@liveworkspace/index-client';
import { BUTTON, ErrorNote } from '../account-panels/account-ui';
import { useDocumentWebhooks } from './host';
import { EventControls, EventPicker, TEXT_BUTTON, WhoPicker } from './pickers';
import { attempt, eventName, eventsOfApp, webhookError } from './webhooks-api';

// A webhook's Sends (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): its events as small labels in
// the document's app's words ("Every Event" when it sends all of them), whose changes (Anyone or Only Me), and Edit,
// which opens the add form's event and Who Did It pickers in place.

const CHIP =
  'bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';

export function WebhookEvents({
  webhook,
  onChanged,
}: {
  webhook: Webhook;
  onChanged: (webhook: Webhook) => void;
}) {
  const { app } = useDocumentWebhooks();
  const [editing, setEditing] = useState(false);
  const every = webhook.events.length === eventsOfApp(app).length;

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
          onDone={(next) => {
            setEditing(false);
            if (next) onChanged(next);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {every ? (
            <Chip radius="sm" className={CHIP}>
              Every Event
            </Chip>
          ) : (
            webhook.events.map((event) => (
              <Chip key={event} radius="sm" className={CHIP}>
                {eventName(app, event)}
              </Chip>
            ))
          )}
          <span
            data-webhook-who={webhook.who}
            className="ml-1 text-xs text-slate-500 dark:text-slate-400"
          >
            {webhook.who === 'me'
              ? webhook.mine
                ? 'Only what you do'
                : 'Only what its creator does'
              : 'By anyone'}
          </span>
        </div>
      )}
    </div>
  );
}

function EventsEditor({
  webhook,
  onDone,
}: {
  webhook: Webhook;
  // The saved webhook, or nothing for Cancel.
  onDone: (webhook: Webhook | null) => void;
}) {
  const { api, app } = useDocumentWebhooks();
  const offered = useMemo(() => eventsOfApp(app), [app]);
  const [draft, setDraft] = useState<Set<WebhookEvent>>(() => new Set(webhook.events));
  const [who, setWho] = useState<WebhookWho>(webhook.who);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = offered.filter((event) => draft.has(event));
  // As sets: the server's order needn't match the app's, and a reorder alone isn't a change to save.
  const saved = new Set(webhook.events);
  const unchanged =
    who === webhook.who && next.length === saved.size && next.every((event) => saved.has(event));

  async function save() {
    setBusy(true);
    setError(null);
    const result = await attempt(() => api.update(webhook.id, { events: next, who }));
    setBusy(false);
    if (result.ok) onDone(result.data.webhook);
    else setError(result.error);
  }

  return (
    <div
      data-events-editor=""
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            What Should It Send?
          </p>
          <EventControls events={offered} value={draft} onChange={setDraft} />
        </div>
        <EventPicker app={app} value={draft} onChange={setDraft} />
      </div>
      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Who Did It?</p>
        <WhoPicker value={who} onChange={setWho} />
      </div>
      {error ? <ErrorNote>{webhookError(error, webhook.kind)}</ErrorNote> : null}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p
          aria-live="polite"
          className="mr-auto text-xs text-slate-500 empty:hidden dark:text-slate-400"
        >
          {next.length === 0 ? 'Pick at least one thing to send.' : ''}
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
