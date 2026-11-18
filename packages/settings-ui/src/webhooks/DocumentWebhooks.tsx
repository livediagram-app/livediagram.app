'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon, ResponsivePopover, ToolFooter, ToolFooterButton } from '@liveworkspace/ui';
import { ToolExplainer, ToolExplainerSkeleton } from '@liveworkspace/ui/tool-explainer';
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
    // The list scrolls; Add Webhook stays pinned at the bottom (owner, 2026-11-17: a tool's main button never scrolls
    // away).
    <div data-document-webhooks="" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* No title band (owner, 2026-11-17: Tools' back bar already names it): a heading for assistive technology and
          for focus to return to, and, once there are webhooks, their count beside Add Webhook. */}
        <h3 ref={headingRef} tabIndex={-1} className="sr-only">
          Webhooks
        </h3>
        {listed.length > 0 ? (
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {listed.length === 1 ? '1 webhook' : `${listed.length} webhooks`}
            </p>
          </div>
        ) : null}

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
          // The empty state's own frame and size (most items have no webhooks yet), so nothing moves when "No Webhooks
          // Yet" arrives (owner, 2026-11-17).
          <div aria-busy data-webhooks-skeleton="" className="px-4 pb-5 pt-4">
            <span className="sr-only">Loading webhooks</span>
            <ToolExplainerSkeleton />
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
          <div data-empty-state="" className="px-4 pb-5 pt-4">
            {/* The tool's explainer (footer-tools-menu.md "Explainers"): nothing set up yet. */}
            <ToolExplainer
              art={webhooksArt}
              title="No Webhooks Yet"
              description={`Tell Slack, Teams or your own service the moment this ${one} changes. Only this ${one}: your other ${ITEM(app).many.toLowerCase()} have their own.`}
              steps={[
                'Add a webhook with the address your service gives you.',
                'Choose the changes it hears about.',
                'Each change is posted there as it happens, signed so it can be trusted.',
              ]}
              data="webhooks"
            />
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
      </div>
      {load.state === 'loading' ? (
        // The footer is there from the first frame, its button waiting, so it never pops in.
        <ToolFooter>
          <ToolFooterButton disabled>
            <PlusIcon size={12} />
            Add Webhook
          </ToolFooterButton>
        </ToolFooter>
      ) : null}
      {load.state === 'ready' ? (
        <ToolFooter>
          {full ? (
            <p className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
              A {one} can have up to {WEBHOOKS_PER_DOCUMENT_MAX} webhooks. Delete one to add
              another.
            </p>
          ) : (
            <ToolFooterButton ref={addRef} onClick={(e) => open(e.currentTarget)}>
              <PlusIcon size={12} />
              Add Webhook
            </ToolFooterButton>
          )}
        </ToolFooter>
      ) : null}
    </div>
  );
}
