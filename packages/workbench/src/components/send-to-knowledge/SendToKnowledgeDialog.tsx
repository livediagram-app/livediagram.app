'use client';

// Send to Knowledge Base's picker (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker"): what's sent
// (the selection's picture and count), a knowledgebase the person can edit, an existing page (at the end or under a
// heading) or a new one, the section's heading and an optional focus; then Write With AI or Add Without Summary, and a
// preview with Insert, Edit and Cancel before anything is written. Centred on screen, a bottom sheet on a phone. With
// the month's AI credits used, the platform's limit notice stands in the summary's place, Add Without Summary beside
// its upgrade. Loaded on its first open (SendToPlanHost).
import { useEffect, useId, useMemo, useState } from 'react';
import {
  IndexError,
  knowledgeSendFallback,
  type App,
  type KnowledgeSendPicture,
  type KnowledgeSendPlace,
} from '@liveworkspace/index-client';
import { AI_CREDIT_COSTS, isOwnerScope, usesAiCredits } from '@liveworkspace/subscription';
import { LimitNotice, ownerViewOf, proOn, useOwnerView } from '@liveworkspace/subscription-ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { sendToKnowledgeHeroArt } from '@liveworkspace/ui/dialog-hero-art/send-to-knowledge';
import { Button, DialogFooter, TextInput, lucideGlyph } from '@liveworkspace/ui';
import { lucideArrowLeft, lucideSparkles } from '@liveworkspace/icons/lucide';
import { workbench } from '../../bindings';
import { useSettled } from '../../hooks/ui/useSettled';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { Dialog } from '../dialogs/Dialog';
import { addKnowledgeSend } from './knowledge-send-store';
import { recallKnowledgeSend, rememberKnowledgeSend } from './knowledge-send-memory';
import { pageTree, selectionWords } from './knowledge-pages';
import { KnowledgePreview } from './KnowledgePreview';
import type {
  KnowledgeCapture,
  KnowledgeSummariser,
  KnowledgeSummaryAnswer,
} from './send-to-knowledge-entry';
import {
  KnowledgebasePicker,
  PagePicker,
  type HeadingList,
  type KnowledgebaseList,
  type PageList,
  type PageMode,
} from './KnowledgeWhere';

const KB_LIST_LIMIT = 30;
const SEARCH_SETTLE_MS = 250;
const HEADING_MAX = 200;
const FOCUS_MAX = 300;
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';
const SparkGlyph = lucideGlyph(lucideSparkles, 15);
const BackGlyph = lucideGlyph(lucideArrowLeft, 15);

type Client = Pick<
  typeof indexClient,
  'listItems' | 'automationTarget' | 'knowledgeOutline' | 'sendToKnowledge'
>;
type Picture =
  { state: 'drawing' } | { state: 'none' } | { state: 'ready'; picture: KnowledgeSendPicture };
type Step =
  | { at: 'form' }
  | { at: 'writing' }
  | { at: 'preview'; markdown: string; byAi: boolean; editing: boolean }
  | { at: 'credits'; refused: Extract<KnowledgeSummaryAnswer, { ok: false }> };

export function SendToKnowledgeDialog({
  capture,
  source,
  sourceTitle,
  summarise,
  onClose,
  client = indexClient,
}: {
  capture: KnowledgeCapture;
  source: { app: App; itemId: string };
  sourceTitle: string;
  summarise: KnowledgeSummariser;
  onClose: () => void;
  client?: Client;
}) {
  const toast = useToast();
  const titleId = useId();
  const headingId = useId();
  const focusId = useId();
  const remembered = useMemo(() => recallKnowledgeSend(source.itemId), [source.itemId]);

  const [query, setQuery] = useState('');
  const settledQuery = useSettled(query.trim(), SEARCH_SETTLE_MS);
  const [kbsFor, setKbsFor] = useState<{ key: string; list: KnowledgebaseList } | null>(null);
  const [kb, setKb] = useState<{ id: string; title: string } | null>(
    remembered ? { id: remembered.kbId, title: remembered.kbTitle } : null,
  );
  const [pagesFor, setPagesFor] = useState<{ kb: string; list: PageList } | null>(null);
  const [mode, setMode] = useState<PageMode>('existing');
  const [pageQuery, setPageQuery] = useState('');
  const [page, setPage] = useState<{ id: string; title: string } | null>(null);
  const [headingsFor, setHeadingsFor] = useState<{ page: string; list: HeadingList } | null>(null);
  const [after, setAfter] = useState('');
  const [newTitle, setNewTitle] = useState(sourceTitle.trim() || 'Untitled');
  const [parent, setParent] = useState('');
  const [heading, setHeading] = useState(capture.heading.slice(0, HEADING_MAX));
  const [focus, setFocus] = useState('');
  const [picture, setPicture] = useState<Picture>({ state: 'drawing' });
  const [step, setStep] = useState<Step>({ at: 'form' });
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workbench.track('UI', 'Opened', 'SendToKnowledge');
  }, []);

  // The picture, drawn once when the picker opens.
  useEffect(() => {
    let live = true;
    capture
      .picture()
      .then((p) => live && setPicture(p ? { state: 'ready', picture: p } : { state: 'none' }))
      .catch(() => live && setPicture({ state: 'none' }));
    return () => {
      live = false;
    };
  }, [capture]);

  // The person's knowledgebases, most recent first.
  useEffect(() => {
    const abort = new AbortController();
    client
      .listItems(
        {
          app: 'liveknowledge',
          view: 'recent',
          limit: KB_LIST_LIMIT,
          ...(settledQuery ? { q: settledQuery } : {}),
        },
        { signal: abort.signal },
      )
      .then((read) => setKbsFor({ key: settledQuery, list: { state: 'ready', items: read.items } }))
      .catch(() => {
        if (!abort.signal.aborted) setKbsFor({ key: settledQuery, list: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [client, settledQuery]);
  const kbs: KnowledgebaseList = kbsFor?.key === settledQuery ? kbsFor.list : { state: 'loading' };

  // The knowledgebase's pages, through liveknowledge's own door with the person's grant (an Editor's alone).
  const kbId = kb?.id ?? null;
  useEffect(() => {
    if (!kbId) return;
    const abort = new AbortController();
    client
      .automationTarget(kbId, { signal: abort.signal })
      .then((d) =>
        setPagesFor({ kb: kbId, list: { state: 'ready', pages: pageTree(d.pages ?? []) } }),
      )
      .catch(() => {
        if (!abort.signal.aborted) setPagesFor({ kb: kbId, list: { state: 'refused' } });
      });
    return () => abort.abort();
  }, [client, kbId]);
  const pages: PageList = !kbId
    ? { state: 'idle' }
    : pagesFor?.kb === kbId
      ? pagesFor.list
      : { state: 'loading' };

  // The picked page's headings, for Where.
  const pageId = page?.id ?? null;
  useEffect(() => {
    if (!kbId || !pageId) return;
    const abort = new AbortController();
    client
      .knowledgeOutline(kbId, pageId, { signal: abort.signal })
      .then((read) =>
        setHeadingsFor({ page: pageId, list: { state: 'ready', headings: read.headings } }),
      )
      // A page whose headings cannot be read still takes the section at its end.
      .catch(() => {
        if (!abort.signal.aborted)
          setHeadingsFor({ page: pageId, list: { state: 'ready', headings: [] } });
      });
    return () => abort.abort();
  }, [client, kbId, pageId]);
  const headings: HeadingList = !pageId
    ? { state: 'idle' }
    : headingsFor?.page === pageId
      ? headingsFor.list
      : { state: 'loading' };

  // Another knowledgebase starts its page over; another page starts Where at the end.
  const pickKb = (next: { id: string; title: string }) => {
    if (next.id === kb?.id) return;
    setKb(next);
    setPage(null);
    setParent('');
    setAfter('');
  };
  const pickPage = (next: { id: string; title: string }) => {
    setPage(next);
    setAfter('');
  };

  const placeReady =
    !!kb &&
    pages.state === 'ready' &&
    (mode === 'existing' ? !!page : newTitle.trim().length > 0) &&
    picture.state !== 'drawing';
  const countWords = selectionWords(capture.selection.items.length, capture.selection.links.length);
  const fallback = () => knowledgeSendFallback(capture.selection);

  const writeWithAi = async () => {
    if (!placeReady) return;
    setError(null);
    setStep({ at: 'writing' });
    const answer = await summarise({
      tabId: capture.tabId,
      selection: capture.selection,
      focus: focus.trim(),
    }).catch((): KnowledgeSummaryAnswer => ({
      ok: false,
      error: 'summary_failed',
      message: "Couldn't reach the AI. Check your connection and try again.",
    }));
    if (answer.ok) {
      workbench.track('UI', 'Used', 'SendToKnowledge');
      setStep({ at: 'preview', markdown: answer.markdown, byAi: true, editing: false });
      return;
    }
    workbench.track('UI', 'Refused', 'SendToKnowledge');
    if (answer.error === 'ai_credits_used') return setStep({ at: 'credits', refused: answer });
    setStep({ at: 'form' });
    setError(answer.message);
  };

  const withoutSummary = () => {
    if (!placeReady) return;
    setError(null);
    setStep({ at: 'preview', markdown: fallback(), byAi: false, editing: false });
  };

  const insert = async () => {
    if (step.at !== 'preview' || !kb || inserting) return;
    const markdown = step.markdown.trim() || fallback();
    const place: KnowledgeSendPlace =
      mode === 'existing' && page
        ? { page: page.id, ...(after ? { after } : {}) }
        : { newPage: { title: newTitle.trim(), parent: parent || null } };
    setInserting(true);
    setError(null);
    try {
      const { send, link } = await client.sendToKnowledge({
        knowledgebase: kb.id,
        place,
        heading: heading.trim(),
        markdown,
        ...(picture.state === 'ready' ? { picture: picture.picture } : {}),
        source: {
          app: source.app,
          itemId: source.itemId,
          tabId: capture.tabId,
          elementIds: capture.elementIds,
        },
      });
      addKnowledgeSend(send);
      rememberKnowledgeSend(source.itemId, { kbId: kb.id, kbTitle: kb.title, at: Date.now() });
      workbench.track('UI', 'Created', 'SendToKnowledge');
      toast.success(`Added to ${send.page.title || 'the page'}`, {
        action: {
          label: 'Open Page',
          onSelect: () => window.open(link, '_blank', 'noopener,noreferrer'),
        },
      });
      onClose();
    } catch (err) {
      workbench.track('UI', 'Refused', 'SendToKnowledge');
      setInserting(false);
      setError(refusal(err));
    }
  };

  const pictureUrl =
    picture.state === 'ready' ? `data:image/png;base64,${picture.picture.png}` : null;
  const credit = AI_CREDIT_COSTS.knowledgeSummary;

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="xl" phoneSheet className="max-h-[92vh]">
      <HeroDialogHeader
        art={sendToKnowledgeHeroArt}
        titleId={titleId}
        title="Send to Knowledge Base"
        subtitle="AI writes up these items on a page in liveknowledge. They stay as they are here."
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
          <WhatsSent
            picture={picture}
            url={pictureUrl}
            words={countWords}
            cut={!!capture.selection.cut}
          />
          {step.at === 'form' || step.at === 'writing' ? (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <section className="flex min-w-0 flex-col gap-2" aria-label="Knowledgebase">
                  <h3 className={LABEL}>Knowledgebase</h3>
                  <KnowledgebasePicker
                    list={kbs}
                    query={query}
                    onQuery={setQuery}
                    pickedId={kb?.id ?? null}
                    picked={kb}
                    onPick={pickKb}
                  />
                </section>
                <section className="flex min-w-0 flex-col gap-2" aria-label="Page">
                  <h3 className={LABEL}>Page</h3>
                  <PagePicker
                    mode={mode}
                    onMode={setMode}
                    pages={pages}
                    pageQuery={pageQuery}
                    onPageQuery={setPageQuery}
                    pageId={page?.id ?? null}
                    onPage={pickPage}
                    headings={headings}
                    after={after}
                    onAfter={setAfter}
                    newTitle={newTitle}
                    onNewTitle={setNewTitle}
                    parent={parent}
                    onParent={setParent}
                  />
                </section>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor={headingId} className={LABEL}>
                    Heading
                  </label>
                  <TextInput
                    id={headingId}
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                    maxLength={HEADING_MAX}
                    placeholder="No heading"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor={focusId} className={LABEL}>
                    Focus{' '}
                    <span className="font-normal normal-case tracking-normal">(optional)</span>
                  </label>
                  <TextInput
                    id={focusId}
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    maxLength={FOCUS_MAX}
                    placeholder="What should it focus on?"
                  />
                </div>
              </div>
            </>
          ) : step.at === 'credits' ? (
            <CreditsUsed refused={step.refused} onWithout={withoutSummary} />
          ) : (
            <KnowledgePreview
              heading={heading}
              markdown={step.markdown}
              editing={step.editing}
              onMarkdown={(markdown) => setStep({ ...step, markdown })}
              picture={pictureUrl}
              source={{ app: source.app, title: sourceTitle }}
            />
          )}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {step.at === 'preview' || step.at === 'credits' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep({ at: 'form' });
                }}
                className="mr-auto shrink-0"
                disabled={inserting}
              >
                <BackGlyph aria-hidden />
                Back
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
                Cancel
              </Button>
              {step.at === 'preview' ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep({ ...step, editing: !step.editing })}
                    className="shrink-0"
                    disabled={inserting}
                  >
                    {step.editing ? 'Done' : 'Edit'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void insert()}
                    disabled={inserting}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {inserting ? 'Inserting…' : 'Insert'}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            // The buttons on one row (wrapping on a phone, where the three are wider than the sheet), and under them a
            // quiet line: nothing is written yet, and what Write With AI costs.
            <div className="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
              <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={withoutSummary}
                disabled={!placeReady || step.at === 'writing'}
                className="shrink-0 whitespace-nowrap"
              >
                Add Without Summary
              </Button>
              <Button
                type="button"
                onClick={() => void writeWithAi()}
                disabled={!placeReady || step.at === 'writing'}
                className="shrink-0 whitespace-nowrap"
                aria-describedby={proOn() ? `${titleId}-cost` : undefined}
              >
                <SparkGlyph aria-hidden />
                {step.at === 'writing' ? 'Writing…' : 'Write With AI'}
              </Button>
              <div className="flex basis-full items-baseline justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <p>Nothing is written until you insert it.</p>
                {proOn() ? <span id={`${titleId}-cost`}>{usesAiCredits(credit)}</span> : null}
              </div>
            </div>
          )}
        </DialogFooter>
      </div>
    </Dialog>
  );
}

function WhatsSent({
  picture,
  url,
  words,
  cut,
}: {
  picture: Picture;
  url: string | null;
  words: string;
  cut: boolean;
}) {
  return (
    <section
      aria-label="What's sent"
      className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50"
    >
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {picture.state === 'drawing' ? (
          <div
            role="status"
            aria-label="Drawing the picture"
            className="size-full animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
          />
        ) : url ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-1 text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            No picture
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{words}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {picture.state === 'none'
            ? 'Too big to picture: the section goes without one.'
            : cut
              ? 'The first of them: a send takes so many at most.'
              : 'Written up from their labels, notes and arrows alone.'}
        </p>
      </div>
    </section>
  );
}

function CreditsUsed({
  refused,
  onWithout,
}: {
  refused: Extract<KnowledgeSummaryAnswer, { ok: false }>;
  onWithout: () => void;
}) {
  const load = useOwnerView(refused.owner && isOwnerScope(refused.owner) ? refused.owner : null);
  const without = (
    <Button
      variant="secondary"
      size="xs"
      className="touch-target relative shrink-0"
      onClick={onWithout}
    >
      Add Without Summary
    </Button>
  );
  if (load.status === 'loading') return null;
  const view = ownerViewOf(load);
  return (
    <div data-knowledge-credits-used={view?.action ?? 'none'} className="flex flex-col gap-3">
      <LimitNotice
        limitKey="aiCreditsPerMonth"
        used={refused.used ?? 1}
        limit={refused.max ?? 1}
        owner={view}
        sentence={refused.message}
        near={false}
        secondaryAction={without}
      />
      {/* With Pro off the notice draws nothing: the plain words and the way on stay. */}
      {!proOn() ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <p className="min-w-0 flex-1">{refused.message}</p>
          {without}
        </div>
      ) : null}
    </div>
  );
}

function refusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'rate_limited')
      return 'That is a lot of sends at once. Try again in a minute.';
    if (err.code === 'source_full') return 'This item has sent as many sections as it may.';
    if (err.code === 'knowledge_refused') {
      const code = err.detail?.code;
      if (code === 'heading_unknown')
        return 'That heading is no longer on the page. Go Back and pick Where again.';
      if (code === 'page_gone') return 'That page is no longer there. Go Back and pick another.';
      if (code === 'page_locked') return 'That page is locked. Pick another page.';
      if (code === 'pages_full') return "The knowledgebase can't take another page there.";
      const reason = err.detail?.reason;
      return typeof reason === 'string' && reason
        ? `The knowledgebase refused: ${reason}.`
        : 'The knowledgebase refused the section.';
    }
    if (err.status === 403 || err.status === 404)
      return "You can't add to this knowledgebase. Pick one you can edit.";
  }
  return "Couldn't add it. Check your connection and try again.";
}
