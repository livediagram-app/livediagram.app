'use client';

import { useId, useState, type FormEvent, type RefObject } from 'react';
import { Select } from '@liveworkspace/ui';
import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
  WEBHOOK_KINDS,
  WEBHOOK_NAME_MAX,
  WEBHOOK_URL_MAX,
  type Webhook,
  type WebhookEvent,
  type WebhookKind,
} from '@liveworkspace/index-client';
import { BUTTON, ErrorNote, INPUT, Panel } from '../account-ui';
import { attempt, KIND_HINTS, KIND_LABELS, webhookError, webhooksClient } from './webhooks-api';

export type TeamChoice = { id: string; name: string };

// Adding a webhook (webhooks.md "Who adds one"): where it sends, a name, whose items (the person's own, or a team they
// run), the URL and the events. A team the person is only a member of isn't offered, and the index checks again.
export function AddWebhook({
  teams,
  nameRef,
  onAdded,
  onCancel,
}: {
  // The teams the person runs now.
  teams: readonly TeamChoice[];
  nameRef: RefObject<HTMLInputElement | null>;
  onAdded: (webhook: Webhook, secret: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<WebhookKind>('json');
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

  const hint = KIND_HINTS[kind];
  return (
    <Panel>
      <form onSubmit={(event) => void submit(event)} aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} className="text-base font-semibold text-slate-900 dark:text-white">
          Add a Webhook
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Sends what happens to the items as it happens. Only what the Timeline would show you.
        </p>

        <div
          role="radiogroup"
          aria-label="Sends to"
          className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
        >
          {WEBHOOK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              aria-label={KIND_LABELS[k]}
              onClick={() => {
                setKind(k);
                setError(null);
              }}
              className={`min-w-0 truncate rounded-full px-2 py-1.5 text-sm font-semibold transition-colors duration-micro ${
                kind === k
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {/* "Microsoft Teams" fits from `sm` up; a phone's segment says "Teams". */}
              <span className={k === 'teams' ? 'hidden sm:inline' : undefined}>
                {KIND_LABELS[k]}
              </span>
              {k === 'teams' && <span className="sm:hidden">Teams</span>}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Name
            <input
              ref={nameRef}
              className={`${INPUT} mt-1`}
              placeholder="Like “#launch channel”"
              maxLength={WEBHOOK_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Items
            <Select
              className="mt-1 flex w-full"
              size="md"
              selectClassName="h-[38px] !rounded-xl !pl-3 !pr-8 !text-sm"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="">Your own items</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}’s items
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {kind === 'json' ? 'Address' : `${KIND_LABELS[kind]} Webhook URL`}
          <input
            className={`${INPUT} mt-1 font-mono`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={hint.placeholder}
            maxLength={WEBHOOK_URL_MAX}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-describedby={`${id}-url-help`}
            required
          />
        </label>
        <p id={`${id}-url-help`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint.help}
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Events</legend>
          <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((e) => (
              <label
                key={e}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={events.has(e)}
                  onChange={(event) => toggle(e, event.target.checked)}
                  className="size-4 rounded border-slate-300"
                />
                {WEBHOOK_EVENT_LABELS[e]}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <ErrorNote>{webhookError(error, kind)}</ErrorNote>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={BUTTON.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={BUTTON.primary}
            disabled={busy || events.size === 0 || !name.trim() || !url.trim()}
          >
            Add Webhook
          </button>
        </div>
      </form>
    </Panel>
  );
}
