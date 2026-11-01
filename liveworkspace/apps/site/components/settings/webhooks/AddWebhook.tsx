'use client';

import { useId, useState, type FormEvent, type RefObject } from 'react';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_NAME_MAX,
  WEBHOOK_URL_MAX,
  type Webhook,
  type WebhookEvent,
  type WebhookKind,
} from '@liveworkspace/index-client';
import { BUTTON, ErrorNote, INPUT } from '../account-ui';
import { DestinationPicker, EventPicker, FormStep, ScopePicker, type TeamChoice } from './pickers';
import { attempt, KINDS, webhookError, webhooksClient } from './webhooks-api';

export type { TeamChoice } from './pickers';

const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300';
const TEXT_BUTTON =
  'relative touch-target-y cursor-pointer rounded text-xs font-semibold text-slate-600 underline-offset-2 transition-colors duration-micro hover:text-slate-900 hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline dark:text-slate-300 dark:hover:text-white';

// Adding a webhook (webhooks.md "Who adds one"; site.md "Settings", Webhooks), in the order a person thinks of it:
// where it posts, its address (with how to get one), a name, whose items (their own, or a team they run) and what it
// sends. A team the person is only a member of isn't offered, and the index checks again.
export function AddWebhook({
  teams,
  firstRef,
  onAdded,
  onCancel,
}: {
  // The teams the person runs now.
  teams: readonly TeamChoice[];
  // The chosen destination, which takes the keyboard as the form opens.
  firstRef: RefObject<HTMLInputElement | null>;
  onAdded: (webhook: Webhook, secret: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<WebhookKind>('slack');
  const [name, setName] = useState('');
  const [scope, setScope] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Set<WebhookEvent>>(() => new Set(WEBHOOK_EVENTS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (event: WebhookEvent, on: boolean) =>
    setEvents((current) => {
      const next = new Set(current);
      if (on) next.add(event);
      else next.delete(event);
      return next;
    });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await attempt(() =>
      webhooksClient.createWebhook({
        name: name.trim(),
        kind,
        url: url.trim(),
        events: WEBHOOK_EVENTS.filter((e) => events.has(e)),
        teamId: scope || null,
      }),
    );
    setBusy(false);
    if (result.ok) await onAdded(result.data.webhook, result.data.secret);
    else setError(result.error);
  }

  const words = KINDS[kind];
  const missing = !name.trim() ? 'a name' : !url.trim() ? 'an address' : null;
  // Whose Items? is asked only of someone who runs a team.
  const whose = teams.length > 0;
  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-heading`}
      data-webhook-form=""
      className="flex flex-col gap-6 bg-slate-50/80 px-4 py-5 sm:px-5 dark:bg-slate-900/40"
    >
      <div>
        <h4 id={`${id}-heading`} className="text-base font-semibold text-slate-900 dark:text-white">
          Add a Webhook
        </h4>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          Each message carries what the Timeline shows: the item’s name and link, who did it, and a
          short detail, like a comment’s first words.
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
        <div className="flex flex-col gap-3">
          <Steps id={`${id}-how`} steps={words.steps} />
          <label className={LABEL}>
            {words.field}
            <input
              className={`${INPUT} mt-1 font-mono`}
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
          <div>
            <label className={LABEL}>
              Name
              <input
                className={`${INPUT} mt-1`}
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

      {whose ? (
        <FormStep n={3} id={`${id}-whose`} title="Whose Items?">
          <ScopePicker teams={teams} value={scope} onChange={setScope} />
        </FormStep>
      ) : null}

      <FormStep
        n={whose ? 4 : 3}
        id={`${id}-what`}
        title="What Should It Send?"
        aside={
          <span className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {events.size} of {WEBHOOK_EVENTS.length}
            </span>
            <button
              type="button"
              className={TEXT_BUTTON}
              disabled={events.size === WEBHOOK_EVENTS.length}
              onClick={() => setEvents(new Set(WEBHOOK_EVENTS))}
            >
              Select All
            </button>
            <button
              type="button"
              className={TEXT_BUTTON}
              disabled={events.size === 0}
              onClick={() => setEvents(new Set())}
            >
              Clear
            </button>
          </span>
        }
      >
        <EventPicker value={events} onToggle={toggle} />
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
              : events.size === 0
                ? 'Pick at least one thing to send.'
                : ''}
          </p>
          <button type="button" className={BUTTON.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={BUTTON.primary}
            disabled={busy || events.size === 0 || missing !== null}
          >
            {busy ? 'Adding…' : 'Add Webhook'}
          </button>
        </div>
      </div>
    </form>
  );
}

// How to get the address: numbered steps for Slack and Teams, one line for a service the person runs.
function Steps({ id, steps }: { id: string; steps: readonly string[] }) {
  if (steps.length === 1)
    return (
      <p id={id} className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {steps[0]}
      </p>
    );
  return (
    <div
      id={id}
      className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        How to Get It
      </p>
      <ol className="mt-1.5 flex flex-col gap-1.5">
        {steps.map((text, i) => (
          <li
            key={text}
            className="flex gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300"
          >
            <span
              aria-hidden
              className="w-3 shrink-0 text-right font-semibold tabular-nums text-slate-400 dark:text-slate-500"
            >
              {i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
