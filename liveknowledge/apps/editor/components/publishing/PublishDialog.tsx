'use client';

// Publish to the Web (docs/specs/030-knowledgebase/publishing.md "The dialog"): an Editor puts the knowledgebase, or
// one section of it, on a public site at /kb/<address>, sees what goes public and what stays private before it does,
// and can take it down. Opened from the knowledgebase's menu. One steady height whatever shows, so nothing jumps when
// the state arrives or a preview changes. With Pro on, the owner's tier's limit shows above What to Publish while
// every knowledgebase it allows is published (spec "Tiers").
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PublishingState } from '@liveknowledge/api-schema';
import { pageTreeRows, isConnectedRow } from '@liveknowledge/document';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  Select,
  SwitchRow,
  TextInput,
  Tooltip,
} from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { apiPublish, apiPublishingState, apiUnpublish } from '@/lib/api/publishing';
import { closePublishing, usePublishingOpen } from '@/lib/publishing/publish-open';
import { publishLimitOf, type PublishLimit as RefusedLimit } from '@/lib/publishing/publish-limit';
import {
  LEFT_OUT_WORDS,
  addressProblem,
  privateCountText,
  publicCountText,
  publishFailureText,
  publishedOnText,
  typedAddress,
  type PublishAction,
} from '@/lib/publishing/publish-words';
import { track } from '@/lib/telemetry';
import { CopyIcon, GlobeIcon, LockIcon, OpenIcon } from './publish-icons';
import { PublishLimit } from './PublishLimit';

/** How many of the pages going public the preview names; the rest are counted. */
export const PREVIEW_PAGES_SHOWN = 8;

const SECTION_TITLE = 'text-sm font-semibold text-slate-900 dark:text-slate-100';
const NOTE = 'text-xs leading-relaxed text-slate-600 dark:text-slate-400';
const WHOLE = '';

/** The dialog, drawn by the editor's dialogs: nothing until opened. */
export function PublishHost() {
  const open = usePublishingOpen();
  const session = useAskSession();
  // Another knowledgebase closes it.
  const documentId = session?.documentId;
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (shown.current !== undefined && shown.current !== documentId) closePublishing();
    shown.current = documentId;
  }, [documentId]);
  if (!open || !session) return null;
  return <PublishDialog session={session} onClose={closePublishing} />;
}

type Settings = { root: string; address: string; noindex: boolean; showWriters: boolean };

export function PublishDialog({ session, onClose }: { session: AskSession; onClose: () => void }) {
  const { documentId, who } = session;
  const titleId = useId();
  const tabs = useEditorChrome((s) => s.tabs);
  const [state, setState] = useState<PublishingState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<PublishAction | null>('read');
  const [failure, setFailure] = useState<{ action: PublishAction; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);
  // A publish the owner's tier refused, with its numbers: truer than the state's until the next read.
  const [refused, setRefused] = useState<RefusedLimit | null>(null);

  // The sections an Editor may publish alone: each page with subpages, in the tree's order.
  const sections = useMemo(() => {
    const pages = tabs.filter((t) => !isConnectedRow(t));
    return pageTreeRows(pages)
      .filter((row) => row.subpages > 0)
      .map((row) => ({
        id: row.page.id,
        title: row.page.name.trim() || 'Untitled Page',
        depth: row.depth,
      }));
  }, [tabs]);

  // The section the state last previewed: a section chosen again reads nothing.
  const previewed = useRef<string | null | undefined>(undefined);
  const load = useCallback(
    (root?: string | null) => {
      const controller = new AbortController();
      setBusy('read');
      apiPublishingState(who, documentId, root, controller.signal)
        .then((next) => {
          previewed.current = next.preview.root;
          setState(next);
          setFailure(null);
          setSettings(
            (was) =>
              was ?? {
                root: next.site?.root ?? WHOLE,
                address: next.defaultAddress,
                noindex: next.site?.noindex ?? false,
                showWriters: next.site?.showWriters ?? false,
              },
          );
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setFailure({ action: 'read', text: publishFailureText(err, 'read') });
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(null);
        });
      return controller;
    },
    [who, documentId],
  );

  // The state when opened, and the preview again whenever the section changes.
  const root = settings?.root;
  useEffect(() => {
    const asked = root === undefined ? undefined : root || null;
    if (asked !== undefined && previewed.current === asked) return;
    const controller = load(asked);
    return () => controller.abort();
  }, [load, root]);

  const site = state?.site ?? null;
  const published = state?.published === true;
  const problem = settings ? addressProblem(settings.address) : null;
  const preview = state?.preview;
  const unchanged =
    site !== null &&
    settings !== null &&
    (site.root ?? WHOLE) === settings.root &&
    site.address === settings.address &&
    site.noindex === settings.noindex &&
    site.showWriters === settings.showWriters;
  const canPublish =
    state?.offered === true &&
    settings !== null &&
    problem === null &&
    busy === null &&
    (preview?.pages.length ?? 0) > 0;

  // At the owner's tier's limit (Pro on): the state's count, or a refused publish's own numbers. Publish stays on, so
  // a press after an upgrade asks the api again.
  const limitMax = refused?.max ?? state?.usage?.limit ?? null;
  const limitUsed = refused?.used ?? state?.usage?.used;
  const atLimit =
    !published && limitMax !== null && limitUsed !== undefined && limitUsed >= limitMax;

  const change = (next: Partial<Settings>) =>
    setSettings((was) => (was ? { ...was, ...next } : was));

  const publish = async () => {
    if (!settings || !canPublish) return;
    setBusy('publish');
    setFailure(null);
    try {
      const next = await apiPublish(who, documentId, {
        address: settings.address,
        root: settings.root || null,
        noindex: settings.noindex,
        showWriters: settings.showWriters,
      });
      track('UI', 'Used', 'PublishSite');
      setState(next);
      setRefused(null);
    } catch (err) {
      const limit = publishLimitOf(err);
      setRefused(limit);
      if (!limit) setFailure({ action: 'publish', text: publishFailureText(err, 'publish') });
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    setConfirming(false);
    setBusy('unpublish');
    setFailure(null);
    try {
      const next = await apiUnpublish(who, documentId);
      track('UI', 'Removed', 'PublishSite');
      setState(next);
    } catch (err) {
      setFailure({ action: 'unpublish', text: publishFailureText(err, 'unpublish') });
    } finally {
      setBusy(null);
    }
  };

  const copy = () => {
    if (!site) return;
    void navigator.clipboard?.writeText(site.url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  };

  // The dialog opens only from a click in the browser (a dynamic import), so it never renders at build time.
  const host = window.location.host;
  const shownPages = preview?.pages.slice(0, PREVIEW_PAGES_SHOWN) ?? [];
  const morePages = (preview?.pages.length ?? 0) - shownPages.length;

  return (
    <>
      <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
        <DialogHeader
          title={<span id={titleId}>Publish to the Web</span>}
          subtitle="A public help centre anyone can read, from this knowledgebase's saved pages."
        >
          <DialogCloseButton onClick={onClose} />
        </DialogHeader>
        <div
          className="min-h-[min(30rem,60dvh)] flex-1 space-y-5 overflow-y-auto px-6 py-5"
          data-publish-dialog=""
        >
          {failure?.action === 'read' && !state ? (
            <Callout
              tone="error"
              size="md"
              role="alert"
              action={{ label: 'Try Again', onSelect: () => void load(root || null) }}
            >
              {failure.text}
            </Callout>
          ) : null}
          {state && !state.offered ? (
            <Callout tone="info" size="md">
              Publishing isn&apos;t available for this knowledgebase.
            </Callout>
          ) : null}

          {/* Where it stands: live at its address, or private. */}
          <div
            data-publish-status={published ? 'published' : 'private'}
            className={`grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-3 max-sm:grid-cols-[auto_minmax(0,1fr)] ${
              published
                ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                published
                  ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {published ? <GlobeIcon /> : <LockIcon />}
            </span>
            <div className="min-w-0">
              <p role="status" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {state ? (published ? 'Live on the Web' : 'Not Published') : ''}
              </p>
              {site ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-medium text-brand-800 underline-offset-2 hover:underline dark:text-brand-300"
                  data-publish-url=""
                >
                  {site.url.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
              {site ? (
                <p className={NOTE} data-publish-date="">
                  {publishedOnText(site.publishedAt)}
                </p>
              ) : (
                <p className={NOTE}>
                  {state ? 'Only the people it is shared with can read it.' : ''}
                </p>
              )}
            </div>
            {site ? (
              // On a phone the actions take a row of their own under the address, so it is not cut short.
              <div className="flex shrink-0 items-center gap-1 max-sm:col-start-2">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={copy}
                  aria-label="Copy the site's link"
                >
                  <CopyIcon />
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
                <Tooltip label="Open the Site">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open the site in a new tab"
                    className="touch-target relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <OpenIcon />
                  </a>
                </Tooltip>
              </div>
            ) : null}
          </div>

          {atLimit && limitMax !== null ? (
            <PublishLimit owner={state?.owner} used={limitUsed} max={limitMax} />
          ) : null}

          {settings ? (
            <>
              <section aria-labelledby={`${titleId}-what`} className="flex flex-col gap-2">
                <h3 id={`${titleId}-what`} className={SECTION_TITLE}>
                  What to Publish
                </h3>
                <Select
                  aria-labelledby={`${titleId}-what`}
                  value={settings.root}
                  disabled={busy === 'publish' || busy === 'unpublish'}
                  className="self-stretch sm:self-start"
                  selectClassName="w-full sm:min-w-[18rem]"
                  onChange={(event) => change({ root: event.target.value })}
                  data-publish-root=""
                >
                  <option value={WHOLE}>The Whole Knowledgebase</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {`${'  '.repeat(section.depth)}${section.title} and Its Subpages`}
                    </option>
                  ))}
                </Select>
              </section>

              <section aria-labelledby={`${titleId}-address`} className="flex flex-col gap-2">
                <label
                  htmlFor={`${titleId}-address-field`}
                  id={`${titleId}-address`}
                  className={SECTION_TITLE}
                >
                  Address
                </label>
                <div
                  className={`flex min-w-0 items-stretch overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-brand-500 dark:bg-slate-900 ${
                    touched && problem
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  <span className="flex shrink items-center truncate border-r border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {host}/kb/
                  </span>
                  <TextInput
                    id={`${titleId}-address-field`}
                    value={settings.address}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={48}
                    aria-invalid={touched && problem ? true : undefined}
                    aria-describedby={`${titleId}-address-note`}
                    disabled={busy === 'publish' || busy === 'unpublish'}
                    className="min-w-0 flex-1 rounded-none border-0 shadow-none focus:ring-0"
                    onChange={(event) => {
                      setTouched(true);
                      change({ address: typedAddress(event.target.value) });
                    }}
                    data-publish-address=""
                  />
                </div>
                <p
                  id={`${titleId}-address-note`}
                  className={touched && problem ? 'text-xs text-red-700 dark:text-red-300' : NOTE}
                >
                  {touched && problem
                    ? problem
                    : published && site && site.address !== settings.address
                      ? 'The old address will lead readers to the new one.'
                      : 'Each page has its own address under this one, made from its title.'}
                </p>
              </section>

              <section aria-label="Options" className="-mx-2 flex flex-col">
                <SwitchRow
                  checked={settings.noindex}
                  onChange={(next) => change({ noindex: next })}
                  disabled={busy === 'publish' || busy === 'unpublish'}
                  className="rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  data-publish-noindex=""
                >
                  <span className="flex min-w-0 flex-col text-left">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Hide From Search Engines
                    </span>
                    <span className={NOTE}>
                      Anyone with the link can read it; search engines are asked not to list it.
                    </span>
                  </span>
                </SwitchRow>
                <SwitchRow
                  checked={settings.showWriters}
                  onChange={(next) => change({ showWriters: next })}
                  disabled={busy === 'publish' || busy === 'unpublish'}
                  className="rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  data-publish-writers=""
                >
                  <span className="flex min-w-0 flex-col text-left">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Show Who Wrote Each Page
                    </span>
                    <span className={NOTE}>
                      Each page names the people who wrote it. Off, no name goes public.
                    </span>
                  </span>
                </SwitchRow>
              </section>

              <section
                aria-labelledby={`${titleId}-preview`}
                className="flex flex-col gap-2"
                data-publish-preview=""
              >
                <h3 id={`${titleId}-preview`} className={SECTION_TITLE}>
                  What Goes Public
                </h3>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    {preview ? publicCountText(preview.pages.length) : 'Reading the pages…'}
                    {preview && preview.leftOut.length > 0
                      ? ` · ${privateCountText(preview.leftOut.length)}`
                      : ''}
                  </p>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {shownPages.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1 text-sm text-slate-800 dark:text-slate-200"
                      >
                        <span aria-hidden className="text-brand-700 dark:text-brand-300">
                          <GlobeIcon />
                        </span>
                        <span className="min-w-0 truncate">{p.title}</span>
                      </li>
                    ))}
                    {morePages > 0 ? (
                      <li className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                        and {morePages} more
                      </li>
                    ) : null}
                    {preview?.leftOut.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1 text-sm text-slate-500 dark:text-slate-400"
                        data-publish-left-out={p.reason}
                      >
                        <span aria-hidden>
                          <LockIcon />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {LEFT_OUT_WORDS[p.reason]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className={NOTE}>
                  Only saved writing goes public: never drafts, comments, Page Health or pages
                  waiting for approval. A page&apos;s pictures, drawings and cover go public with
                  it.
                </p>
              </section>
            </>
          ) : null}

          {failure && failure.action !== 'read' ? (
            <Callout tone="error" size="md" role="alert">
              {failure.text}
            </Callout>
          ) : null}
        </div>
        <DialogFooter>
          {published ? (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={busy !== null}
              onClick={() => setConfirming(true)}
              data-publish-unpublish=""
            >
              Unpublish
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {published && unchanged ? 'Done' : 'Cancel'}
          </Button>
          {!(published && unchanged) ? (
            <Button
              variant="primary"
              disabled={!canPublish}
              onClick={() => void publish()}
              data-publish-go=""
            >
              {busy === 'publish'
                ? published
                  ? 'Updating…'
                  : 'Publishing…'
                : published
                  ? 'Update Site'
                  : 'Publish'}
            </Button>
          ) : null}
        </DialogFooter>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title="Unpublish This Site?"
        message={`Every page comes off the web, within a minute everywhere, and ${site ? `${host}/kb/${site.address}` : 'its address'} is let go.`}
        confirmLabel="Unpublish"
        onConfirm={() => void unpublish()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
