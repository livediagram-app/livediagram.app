'use client';

import { useId, useMemo, useState, type FormEvent, type RefObject } from 'react';
import {
  WEBHOOK_NAME_MAX,
  WEBHOOK_URL_MAX,
  type Webhook,
  type WebhookEvent,
  type WebhookKind,
  type WebhookWho,
} from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { BUTTON, ErrorNote, INPUT } from '../account-panels/account-ui';
import { ConnectPanel } from './ConnectPanel';
import { DestinationPicker, EventControls, EventPicker, FormStep, WhoPicker } from './pickers';
import { useDocumentWebhooks } from './host';
import { attempt, eventsOfApp, ITEM, KINDS, webhookError } from './webhooks-api';

const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300';

// Adding a webhook to the document (webhooks.md "Who adds one", "Managing them"), in the order a person thinks of it:
// where it posts, its address (with how to get one), a name, what it sends (the document's app's events, none chosen
// at first) and whose changes (anyone's, or only their own).
export function AddWebhook({
  firstRef,
  onAdded,
  onCancel,
}: {
  // The chosen destination, which takes the keyboard as the form opens.
  firstRef: RefObject<HTMLInputElement | null>;
  onAdded: (webhook: Webhook, secret: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<WebhookKind>('slack');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [who, setWho] = useState<WebhookWho>('anyone');
  const { api, app } = useDocumentWebhooks();
  const offered = useMemo(() => eventsOfApp(app), [app]);
  const [events, setEvents] = useState<Set<WebhookEvent>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await attempt(() =>
      api.create({
        name: name.trim(),
        kind,
        url: url.trim(),
        events: offered.filter((event) => events.has(event)),
        who,
      }),
    );
    setBusy(false);
    if (result.ok) await onAdded(result.data.webhook, result.data.secret);
    else setError(result.error);
  }

  const words = KINDS[kind];
  const chosen = offered.reduce((n, event) => n + (events.has(event) ? 1 : 0), 0);
  const missing = !name.trim() ? 'a name' : !url.trim() ? 'an address' : null;
  const one = ITEM(app).one.toLowerCase();
  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-heading`}
      data-webhook-form=""
      className="flex flex-col gap-6 bg-slate-50/80 px-5 py-5 sm:px-6 dark:bg-slate-900/40"
    >
      <div>
        <h4 id={`${id}-heading`} className="text-base font-semibold text-slate-900 dark:text-white">
          Add a Webhook
        </h4>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          It posts only what happens to this {one}. Each message carries what its History shows:
          the {one}’s name and link, who did it, and a short detail, like a comment’s first words.
        </p>
      </div>

      <FormStep n={1} id={`${id}-where`} title="Where Should It Post?">
        <DestinationPicker
          inputRef={firstRef}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setError(null);
          }}
        />
      </FormStep>

      <FormStep n={2} id={`${id}-address`} title="Connect It">
        <div className="flex flex-col gap-4">
          <ConnectPanel kind={kind} guideId={`${id}-how`}>
            <label className={LABEL}>
              {words.field}
              <input
                className={`${INPUT} mt-1.5 font-mono`}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={words.placeholder}
                maxLength={WEBHOOK_URL_MAX}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-describedby={`${id}-how`}
                required
              />
            </label>
          </ConnectPanel>
          <div>
            <label className={LABEL}>
              Name
              <input
                className={`${INPUT} mt-1.5`}
                placeholder={words.namePlaceholder}
                maxLength={WEBHOOK_NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={`${id}-name-help`}
                required
              />
            </label>
            <p id={`${id}-name-help`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              A label for you, like the channel it posts to.
            </p>
          </div>
        </div>
      </FormStep>

      <FormStep
        n={3}
        id={`${id}-what`}
        title="What Should It Send?"
        aside={<EventControls events={offered} value={events} onChange={setEvents} />}
      >
        <EventPicker app={app} value={events} onChange={setEvents} />
      </FormStep>

      <FormStep n={4} id={`${id}-who`} title="Who Did It?">
        <WhoPicker value={who} onChange={setWho} />
      </FormStep>

      <div className="flex flex-col gap-3">
        {error ? <ErrorNote>{webhookError(error, kind)}</ErrorNote> : null}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <p
            aria-live="polite"
            className="mr-auto text-xs text-slate-500 empty:hidden dark:text-slate-400"
          >
            {missing
              ? `Add ${missing} to finish.`
              : chosen === 0
                ? 'Pick at least one thing to send.'
                : ''}
          </p>
          <button type="button" className={BUTTON.secondary} onClick={onCancel}>
            Cancel
          </button>
          <Button
            type="submit"
            variant="none"
            className={BUTTON.primary}
            // Only what the form lacks disables it. While it adds, it keeps the keyboard (busy-buttons.md): a
            // disabled button drops it to the dialog's top, and an error then left the person nowhere near it.
            disabled={chosen === 0 || missing !== null}
            busy={busy}
          >
            {busy ? 'Adding…' : 'Add Webhook'}
          </Button>
        </div>
      </div>
    </form>
  );
}
