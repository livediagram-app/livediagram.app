'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import { SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import { WEBHOOK_SIGNATURE_HEADER, type Webhook } from '@liveworkspace/index-client';
import { accountApi, type MyTeam } from '@/lib/account-api';
import { BUTTON, ErrorNote } from '../account-ui';
import { SecretReveal } from '../SecretReveal';
import { AddWebhook, type TeamChoice } from './AddWebhook';
import { WebhookRow } from './WebhookRow';
import { attempt, webhookError, webhooksClient } from './webhooks-api';

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; webhooks: Webhook[] };

const listWebhooks = () => attempt(() => webhooksClient.listWebhooks());
const loadOf = (result: Awaited<ReturnType<typeof listWebhooks>>): Load =>
  result.ok
    ? { state: 'ready', webhooks: result.data.webhooks }
    : { state: 'error', error: result.error };

// Settings › Webhooks (liveworkspace/docs/specs/010-site/site.md "Settings", liveworkspace/docs/specs/004-index/webhooks.md):
// the person's own webhooks and those of the teams they run, adding one (its signing secret shown once), and each
// one's test, pause, delete and recent deliveries. Read when the category is first shown: the index's list, and the
// person's teams from accounts for their names and which they run.
export function WebhooksPanel() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<{ name: string; secret: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
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

  // The form's field takes the keyboard as it opens.
  useEffect(() => {
    if (adding) nameRef.current?.focus();
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
        ? {
            state: 'ready',
            webhooks: current.webhooks.map((w) => (w.id === next.id ? next : w)),
          }
        : current,
    );

  const addButton = (
    <button
      ref={addRef}
      type="button"
      className={BUTTON.primary}
      onClick={() => {
        setMade(null);
        setAdding(true);
      }}
    >
      Add Webhook
    </button>
  );

  return (
    <div className="space-y-6">
      {adding && (
        <AddWebhook
          teams={admin}
          nameRef={nameRef}
          onCancel={() => {
            setAdding(false);
            requestAnimationFrame(() => addRef.current?.focus());
          }}
          onAdded={async (webhook, secret) => {
            setAdding(false);
            if (secret) setMade({ name: webhook.name, secret });
            await refresh();
            if (!secret) headingRef.current?.focus();
          }}
        />
      )}
      {made && (
        <SecretReveal
          title={`${made.name} is added. Copy its signing secret now: it won’t be shown again.`}
          secret={made.secret}
          onDone={() => {
            setMade(null);
            headingRef.current?.focus();
          }}
        >
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Each delivery carries <code className="font-mono">{WEBHOOK_SIGNATURE_HEADER}</code>:{' '}
            <code className="font-mono">v1=</code> and the HMAC-SHA256, in hex, of the timestamp
            header, a dot and the body, keyed with this secret.
          </p>
        </SecretReveal>
      )}

      <section aria-labelledby="your-webhooks">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="your-webhooks"
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-slate-900 outline-none dark:text-white"
          >
            Your Webhooks
          </h2>
          {!adding && load.state === 'ready' && load.webhooks.length > 0 && addButton}
        </div>
        {load.state === 'loading' && (
          <div
            aria-busy
            className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        )}
        {load.state === 'error' && <ErrorNote>{webhookError(load.error)}</ErrorNote>}
        {load.state === 'ready' &&
          (load.webhooks.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <CompactEmptyState
                icon={<SettingsSharedGlyph id="webhooks" />}
                title="No webhooks yet"
                description="Post to a Slack or Teams channel, or to your own service, when an item is made, moved, shared or commented on."
                action={adding ? undefined : addButton}
                className="py-8"
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {load.webhooks.map((webhook) => (
                <WebhookRow
                  key={webhook.id}
                  webhook={webhook}
                  scopeName={scopeName(webhook.teamId)}
                  onChanged={replace}
                  onDeleted={async () => {
                    await refresh();
                    headingRef.current?.focus();
                  }}
                />
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
