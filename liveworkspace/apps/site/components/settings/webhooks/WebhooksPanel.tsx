'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompactEmptyState, PlusIcon } from '@liveworkspace/ui';
import { SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import { WEBHOOK_SIGNATURE_HEADER, type Webhook } from '@liveworkspace/index-client';
import { accountApi, type MyTeam } from '@/lib/account-api';
import { BUTTON, ErrorNote } from '../account-ui';
import { SecretReveal } from '../SecretReveal';
import { AddWebhook, type TeamChoice } from './AddWebhook';
import { EveryAppName } from './marks';
import { WebhookRow } from './WebhookRow';
import { attempt, webhookError, webhooksClient } from './webhooks-api';

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  // `at`: when it was read, so every row's "2 hours ago" agrees.
  | { state: 'ready'; webhooks: Webhook[]; at: number };

const listWebhooks = () => attempt(() => webhooksClient.listWebhooks());
const loadOf = (result: Awaited<ReturnType<typeof listWebhooks>>): Load =>
  result.ok
    ? { state: 'ready', webhooks: result.data.webhooks, at: Date.now() }
    : { state: 'error', error: result.error };

// Settings › Webhooks (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks; liveworkspace/docs/specs/004-index/
// webhooks.md): one card, as the Notifications' are, saying what a webhook is and which apps' work it covers, then
// the person's own webhooks and those of the teams they run, adding one (a plain one's signing secret shown once),
// and each one's test, pause, delete and recent deliveries. Read when the category is first shown: the index's
// list, and the person's teams from accounts for their names and which they run. Signed in only: the panel never
// draws it for a guest (SiteSettingsDialog), and the index refuses one.
export function WebhooksPanel() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<{ name: string; secret: string } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => setLoad(loadOf(await listWebhooks())), []);

  useEffect(() => {
    let live = true;
    void listWebhooks().then((result) => {
      if (live) setLoad(loadOf(result));
    });
    void accountApi<{ teams: MyTeam[] }>('/teams').then((result) => {
      if (live && result.ok) setTeams(result.data.teams ?? []);
    });
    return () => {
      live = false;
    };
  }, []);

  // The form's first choice takes the keyboard as it opens.
  useEffect(() => {
    if (adding) firstRef.current?.focus();
  }, [adding]);

  const admin = useMemo<TeamChoice[]>(
    () => teams.filter((t) => t.role === 'admin').map((t) => ({ id: t.id, name: t.name })),
    [teams],
  );
  const scopeName = (teamId: string | null) =>
    teamId === null
      ? 'Your own items'
      : `${teams.find((t) => t.id === teamId)?.name ?? 'A team'}’s items`;

  const replace = (next: Webhook) =>
    setLoad((current) =>
      current.state === 'ready'
        ? { ...current, webhooks: current.webhooks.map((w) => (w.id === next.id ? next : w)) }
        : current,
    );

  const open = () => {
    setMade(null);
    setFresh(null);
    setAdding(true);
  };
  const listed = load.state === 'ready' ? load.webhooks : [];

  return (
    <div data-webhooks-panel="" className="flex flex-col">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm shadow-slate-900/20 dark:from-slate-500 dark:to-slate-700"
        >
          <SettingsSharedGlyph id="webhooks" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <h4
            ref={headingRef}
            tabIndex={-1}
            className="text-[15px] font-semibold text-slate-900 outline-none dark:text-white"
          >
            Post Updates Where Your Team Talks
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            A webhook posts a message to a Slack or Microsoft Teams channel, or to a service you
            run, when something happens to your work: it’s made, shared, commented on, or a card
            moves.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>For your work in</span>
            <EveryAppName />
          </div>
        </div>
        {!adding && listed.length > 0 ? (
          <button
            ref={addRef}
            type="button"
            className={`${BUTTON.primary} ml-14 gap-1.5 sm:ml-0`}
            onClick={open}
          >
            <PlusIcon size={14} />
            Add Webhook
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="border-t border-slate-100 dark:border-slate-700/70">
          <AddWebhook
            teams={admin}
            firstRef={firstRef}
            onCancel={() => {
              setAdding(false);
              requestAnimationFrame(() => (addRef.current ?? headingRef.current)?.focus());
            }}
            onAdded={async (webhook, secret) => {
              setAdding(false);
              setFresh(webhook.id);
              if (secret) setMade({ name: webhook.name, secret });
              await refresh();
              if (!secret) headingRef.current?.focus();
            }}
          />
        </div>
      ) : null}
      {made ? (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-700/70">
          <SecretReveal
            // The name isolated (<bdi>): a right-to-left one, or one kept from before names were cleaned, never
            // turns the sentence around it.
            title={
              <>
                “<bdi>{made.name}</bdi>” is added. Copy its signing secret now: it won’t be shown
                again.
              </>
            }
            secret={made.secret}
            onDone={() => {
              setMade(null);
              headingRef.current?.focus();
            }}
          >
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Your service uses it to check each delivery came from us: every one carries{' '}
              <code className="whitespace-nowrap font-mono text-[12.5px]">
                {WEBHOOK_SIGNATURE_HEADER}
              </code>
              , <code className="whitespace-nowrap font-mono text-[12.5px]">v1=</code> and the
              HMAC-SHA256, in hex, of the timestamp header, a dot and the body, keyed with this
              secret.
            </p>
          </SecretReveal>
        </div>
      ) : null}

      {load.state === 'loading' ? (
        <div aria-busy className="border-t border-slate-100 dark:border-slate-700/70">
          {[0, 1].map((n) => (
            <div key={n} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <div className="size-10 shrink-0 animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60" />
                <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-700/40" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {load.state === 'error' ? (
        <div className="border-t border-slate-100 px-4 pb-4 sm:px-5 dark:border-slate-700/70">
          <ErrorNote>{webhookError(load.error)}</ErrorNote>
          <button
            type="button"
            className={`${BUTTON.secondary} mt-3`}
            onClick={() => {
              setLoad({ state: 'loading' });
              void refresh();
            }}
          >
            Try Again
          </button>
        </div>
      ) : null}
      {load.state === 'ready' && listed.length === 0 && !adding ? (
        <div className="border-t border-slate-100 dark:border-slate-700/70">
          <CompactEmptyState
            icon={<SettingsSharedGlyph id="webhooks" />}
            title="No Webhooks Yet"
            description="Add one to post updates about your work to a Slack or Teams channel."
            action={
              <button
                ref={addRef}
                type="button"
                className={`${BUTTON.primary} gap-1.5`}
                onClick={open}
              >
                <PlusIcon size={14} />
                Add Webhook
              </button>
            }
            className="py-8"
          />
        </div>
      ) : null}
      {listed.length > 0 ? (
        <ul aria-label="Your webhooks">
          {listed.map((webhook) => (
            <WebhookRow
              key={webhook.id}
              webhook={webhook}
              scopeName={scopeName(webhook.teamId)}
              fresh={webhook.id === fresh && !made}
              now={load.state === 'ready' ? load.at : 0}
              onChanged={replace}
              onDeleted={async () => {
                await refresh();
                headingRef.current?.focus();
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
