'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon, ResponsivePopover } from '@liveworkspace/ui';
import { ToolExplainer } from '@liveworkspace/ui/tool-explainer';
import { webhooksArt } from '@liveworkspace/ui/tool-explainer-art';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOKS_PER_DOCUMENT_MAX,
  type App,
  type IndexClient,
  type ShareAccess,
  type Webhook,
} from '@liveworkspace/index-client';
import { BUTTON, ErrorNote } from '../account-panels/account-ui';
import { SecretReveal } from '../account-panels/SecretReveal';
import { AddWebhook } from './AddWebhook';
import { DocumentWebhooksProvider, useDocumentWebhooks } from './host';
import { WebhookRow } from './WebhookRow';
import { attempt, documentWebhooksApi, ITEM, webhookError } from './webhooks-api';

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  // `at`: when it was read, so every row's "2 hours ago" agrees.
  | { state: 'ready'; webhooks: Webhook[]; at: number };

type Listed = Awaited<ReturnType<typeof attempt<{ webhooks: Webhook[] }>>>;
const loadOf = (result: Listed): Load =>
  result.ok
    ? { state: 'ready', webhooks: result.data.webhooks, at: Date.now() }
    : { state: 'error', error: result.error };

/**
 * A document's webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"), the body of the Webhooks
 * dialog its ⋯ menu opens: a line saying they are this document's alone, its webhooks, adding one (a plain one's
 * signing secret shown once), and each one's test, pause, delete and recent deliveries. Read as it opens. For an
 * account who can edit all of the document; the index checks that on every call, and says so to anyone else.
 */
export function DocumentWebhooks({
  client,
  itemId,
  app,
  share,
}: {
  client: IndexClient;
  itemId: string;
  // The document's app: its events, in its words.
  app: App;
  // The link the page opened the document through, for an Editor who isn't its owner or in its team.
  share?: ShareAccess | null;
}) {
  const code = share?.code ?? null;
  const password = share?.password ?? null;
  const host = useMemo(
    () => ({
      api: documentWebhooksApi(client, itemId, code ? { code, password } : null),
      app,
    }),
    [client, itemId, code, password, app],
  );
  return (
    <DocumentWebhooksProvider value={host}>
      <WebhooksList />
    </DocumentWebhooksProvider>
  );
}

function WebhooksList() {
  const { api, app } = useDocumentWebhooks();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [adding, setAdding] = useState(false);
  // What the add popover opens beside: the dialog (or Tools) the list is in, else the Add button itself.
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const addTitleId = useId();
  const [made, setMade] = useState<{ name: string; secret: string } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => setLoad(loadOf(await attempt(api.list))), [api]);

  useEffect(() => {
    let live = true;
    void attempt(api.list).then((result) => {
      if (live) setLoad(loadOf(result));
    });
    return () => {
      live = false;
    };
  }, [api]);

  // The form's first choice takes the keyboard as it opens, in the same commit (a layout effect), so focus never
  // falls to the page from the Add button the form replaces.
  useLayoutEffect(() => {
    if (adding) firstRef.current?.focus();
  }, [adding]);

  const replace = (next: Webhook) =>
    setLoad((current) =>
      current.state === 'ready'
        ? {
            ...current,
            webhooks: current.webhooks.map((w) => (w.id === next.id ? next : w)),
          }
        : current,
    );

  const open = (from: HTMLElement) => {
    setMade(null);
    setFresh(null);
    setAddAnchor(from.closest<HTMLElement>('[role="dialog"]') ?? from);
    setAdding(true);
  };
  const cancelAdd = () => {
    setAdding(false);
    requestAnimationFrame(() => (addRef.current ?? headingRef.current)?.focus());
  };
  const listed = load.state === 'ready' ? load.webhooks : [];
  const full = listed.length >= WEBHOOKS_PER_DOCUMENT_MAX;
  const one = ITEM(app).one.toLowerCase();

  return (
    <div data-document-webhooks="" className="flex flex-col">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1 basis-60">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-[15px] font-semibold text-slate-900 outline-none dark:text-white"
          >
            Post Updates Where Your Team Talks
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            A webhook posts to a Slack or Microsoft Teams channel, or to a service you run, when
            something happens to this {one}.
          </p>
          <p
            data-webhooks-scope=""
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            Only for this {one}. Your other {ITEM(app).many.toLowerCase()} have their own.
          </p>
        </div>
        {listed.length > 0 && !full ? (
          <button
            ref={addRef}
            type="button"
            className={`${BUTTON.primary} gap-1.5`}
            onClick={(e) => open(e.currentTarget)}
          >
            <PlusIcon size={14} />
            Add Webhook
          </button>
        ) : null}
      </div>

      {/* Adding opens beside the list (a drawer on a phone), so the list stays in view and the dialog never grows. */}
      <ResponsivePopover
        open={adding}
        onClose={cancelAdd}
        anchor={addAnchor}
        titleId={addTitleId}
        width={440}
        placement="side"
        bare
      >
        <AddWebhook
          titleId={addTitleId}
          firstRef={firstRef}
          onCancel={cancelAdd}
          onAdded={async (webhook, secret) => {
            setAdding(false);
            setFresh(webhook.id);
            if (secret) setMade({ name: webhook.name, secret });
            await refresh();
            if (!secret) headingRef.current?.focus();
          }}
        />
      </ResponsivePopover>
      {made ? (
        <div className="border-t border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-700/70">
          <SecretReveal
            // The name isolated (<bdi>): a right-to-left one never turns the sentence around it.
            title={
              <>
                “<bdi>{made.name}</bdi>” is added. Copy its signing secret now: it won’t be shown
                again.
              </>
            }
            secret={made.secret}
            // The form that made it is gone: the keyboard goes to Copy rather than the dialog's top.
            focusCopy
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
        // In the empty state's shape and size (most items have no webhooks yet), so the panel does not shrink while it
        // loads and grow again when "No Webhooks Yet" arrives (owner, 2026-11-17).
        <div
          aria-busy
          data-webhooks-skeleton=""
          className="flex flex-col items-center gap-2 border-t border-slate-100 p-4 py-8 dark:border-slate-700/70"
        >
          <span className="sr-only">Loading webhooks</span>
          <div className="h-10 w-10 animate-pulse motion-reduce:animate-none rounded-xl bg-slate-200/80 dark:bg-slate-700/60" />
          <div className="mt-0.5 h-3.5 w-32 animate-pulse motion-reduce:animate-none rounded bg-slate-200/80 dark:bg-slate-700/60" />
          <div className="h-3 w-64 max-w-full animate-pulse motion-reduce:animate-none rounded bg-slate-100 dark:bg-slate-700/40" />
          <div className="h-3 w-48 max-w-full animate-pulse motion-reduce:animate-none rounded bg-slate-100 dark:bg-slate-700/40" />
          <div className="mt-1 h-8 w-32 animate-pulse motion-reduce:animate-none rounded-lg bg-slate-200/80 dark:bg-slate-700/60" />
        </div>
      ) : null}
      {load.state === 'error' ? (
        <div className="border-t border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-700/70">
          <ErrorNote>{webhookError(load.error)}</ErrorNote>
          {load.error !== 'webhooks_need_editor' && load.error !== 'webhooks_need_account' ? (
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
          ) : null}
        </div>
      ) : null}
      {load.state === 'ready' && listed.length === 0 ? (
        <div
          data-empty-state=""
          className="border-t border-slate-100 px-4 py-4 dark:border-slate-700/70"
        >
          {/* The tool's explainer (footer-tools-menu.md "Explainers"): nothing set up yet. */}
          <ToolExplainer
            art={webhooksArt}
            title="No Webhooks Yet"
            description={`Tell Slack, Teams or your own service the moment this ${one} changes.`}
            steps={[
              'Add a webhook with the address your service gives you.',
              'Choose the changes it hears about.',
              'Each change is posted there as it happens, signed so it can be trusted.',
            ]}
            data="webhooks"
          >
            <button
              ref={addRef}
              type="button"
              className={`${BUTTON.primary} w-full justify-center gap-1.5`}
              onClick={(e) => open(e.currentTarget)}
            >
              <PlusIcon size={14} />
              Add Webhook
            </button>
          </ToolExplainer>
        </div>
      ) : null}
      {listed.length > 0 ? (
        <ul aria-label={`This ${one}’s webhooks`}>
          {listed.map((webhook) => (
            <WebhookRow
              key={webhook.id}
              webhook={webhook}
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
      {full ? (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6 dark:border-slate-700/70 dark:text-slate-400">
          A {one} can have up to {WEBHOOKS_PER_DOCUMENT_MAX} webhooks. Delete one to add another.
        </p>
      ) : null}
    </div>
  );
}
