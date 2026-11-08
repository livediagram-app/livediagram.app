'use client';

import { useId, useMemo, useState, type FormEvent, type RefObject } from 'react';
import {
  orderedTopics,
  WEBHOOK_NAME_MAX,
  WEBHOOK_URL_MAX,
  type App,
  type Webhook,
  type WebhookKind,
  type WebhookTopic,
} from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { BUTTON, ErrorNote, INPUT } from '../account-ui';
import { ConnectPanel } from './ConnectPanel';
import {
  DestinationPicker,
  EventControls,
  EventPicker,
  FormStep,
  ScopePicker,
  type TeamChoice,
} from './pickers';
import { useAccountPanelsHost } from '../host';
import { attempt, KINDS, topicsOfApps, webhookError } from './webhooks-api';

export type { TeamChoice } from './pickers';

const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300';

// Adding a webhook (webhooks.md "Who adds one"; site.md "Settings", Webhooks), in the order a person thinks of it:
// where it posts, its address (with how to get one), a name, whose items (their own, or a team they run) and what it
// sends: the events of the apps the card covers (this app's on This App, every app's on All), all chosen at first. A
// team the person is only a member of isn't offered, and the index checks again.
export function AddWebhook({
  apps,
  teams,
  firstRef,
  onAdded,
  onCancel,
}: {
  // The apps whose events it offers.
  apps: readonly App[];
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
  const offered = useMemo(() => topicsOfApps(apps), [apps]);
  const [events, setEvents] = useState<Set<WebhookTopic>>(() => new Set(offered));
  const { index } = useAccountPanelsHost();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await attempt(() =>
      index.createWebhook({
        name: name.trim(),
        kind,
        url: url.trim(),
        events: orderedTopics(offered.filter((topic) => events.has(topic))),
        teamId: scope || null,
      }),
    );
    setBusy(false);
    if (result.ok) await onAdded(result.data.webhook, result.data.secret);
    else setError(result.error);
  }

  const words = KINDS[kind];
  const chosen = offered.reduce((n, topic) => n + (events.has(topic) ? 1 : 0), 0);
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

      {whose ? (
        <FormStep n={3} id={`${id}-whose`} title="Whose Items?">
          <ScopePicker teams={teams} value={scope} onChange={setScope} />
        </FormStep>
      ) : null}

      <FormStep
        n={whose ? 4 : 3}
        id={`${id}-what`}
        title="What Should It Send?"
        aside={<EventControls topics={offered} value={events} onChange={setEvents} />}
      >
        <EventPicker apps={apps} value={events} onChange={setEvents} />
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
