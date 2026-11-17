'use client';

// Publish as Roadmap (docs/specs/026-plan/public-roadmap.md "The dialog"): a board of the tab as a public page, read
// fresh when it opens, in one of two states. Not published: the settings and Publish Roadmap. Published: the live link
// with Copy Link and Open Roadmap, the settings saving as they change (the link kept), and Unpublish behind a confirm.
// A tab with several boards gets a board picker at the top. The privacy note is always there. With Voting on, a chosen
// card type whose cards would not show their votes is offered Add Votes (one change to the plan's card types).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PublishedRoadmap, RoadmapSettings, RoadmapsResponse } from '@liveplanner/api-schema';
import {
  Button,
  ConfirmPopover,
  buttonClassName,
  lucideGlyph,
  useCopiedFlash,
} from '@liveplanner/ui';
import { ToolFooter, ToolFooterButton } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import {
  lucideExternalLink,
  lucideGlobe,
  lucideLock,
  lucideSquareKanban,
} from '@liveworkspace/icons/lucide';
import { hasUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { ChoicePills } from '@/components/primitives/ChoicePills';
import { apiPublishForm } from '@/lib/api/forms';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { typeShowsVotes, withInheritance, withVotesShown } from '@liveplanner/items';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';
import { track } from '@/lib/telemetry';
import { readRoadmaps, saveRoadmap, unpublishRoadmap } from './roadmap-client';
import { defaultRoadmapSettings, settingsReady } from './roadmap-defaults';
import type { RoadmapScope } from './roadmap-gate';
import { roadmapHeroArt } from './RoadmapHeroArt';
import { RoadmapSettingsForm } from './RoadmapSettingsForm';

const LockIcon = lucideGlyph(lucideLock, 14);
const GlobeIcon = lucideGlyph(lucideGlobe, 14);
const ExternalIcon = lucideGlyph(lucideExternalLink, 14);

const LINK_FIELD =
  'w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

const settingsOf = (r: PublishedRoadmap): RoadmapSettings => ({
  title: r.title,
  columns: r.columns,
  types: r.types,
  fields: r.fields,
  voting: r.voting,
  formCode: r.formCode,
});

// "Project", "Project and Bug", "Project, Bug and Task".
export function namesOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function RoadmapDialog({
  scope,
  startTabId,
  cardTypes,
  onClose,
}: {
  scope: RoadmapScope;
  // The tab in view when it opened: the Tab picker starts there when it holds a board.
  startTabId: string;
  // The plan's card types and their changes (useItemTypes): what Add Votes reads and changes. Absent: no offer.
  cardTypes?: Pick<ItemTypesSlice, 'catalogue' | 'types' | 'saveCatalogue'> | undefined;
  onClose: () => void;
}) {
  const titleId = useId();
  const [tabId, setTabId] = useState(startTabId);
  const fieldId = useId();
  const [data, setData] = useState<RoadmapsResponse | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  // The settings for a board not yet published (a published one's are its own).
  const [draft, setDraft] = useState<RoadmapSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirming, setConfirming] = useState<HTMLElement | null>(null);
  const { copied, flash } = useCopiedFlash(1800);
  // The types Add Votes was just given, named for the note that says so.
  const [votesAdded, setVotesAdded] = useState<string | null>(null);
  const editor = useOptionalEditorContext();
  const [makingForm, setMakingForm] = useState(false);
  const [formProblem, setFormProblem] = useState<string | null>(null);
  // Create a Suggestion Form is chosen, to be made on Publish.
  const [formPending, setFormPending] = useState(false);
  // One form at a time, whatever presses come in while it is made.
  const making = useRef(false);

  const read = useCallback(async () => {
    try {
      setData(await readRoadmaps(scope));
    } catch {
      setReadFailed(true);
    }
  }, [scope]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a fetch from the api: its state lands after the await, never synchronously
    void read();
  }, [read]);

  // The plan's tabs holding a board the api knows, in plan order, and the chosen one's boards (a board just drawn may
  // not be saved yet). A chosen tab with none falls back to the first that has some.
  const tabs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of data?.boards ?? []) if (!seen.has(b.tabId)) seen.set(b.tabId, b.tabName);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [data]);
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0] ?? null;
  const boards = useMemo(
    () => (data && tab ? data.boards.filter((b) => b.tabId === tab.id) : []),
    [data, tab],
  );
  const board = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;
  // Whether a tab has a board already out as a roadmap.
  const publishedOn = (id: string) =>
    !!data?.boards.some((b) => b.tabId === id && data.roadmaps.some((r) => r.boardId === b.id));
  const published = board ? (data?.roadmaps.find((r) => r.boardId === board.id) ?? null) : null;
  const settings: RoadmapSettings | null = board
    ? published
      ? settingsOf(published)
      : draft && boardId === board.id
        ? draft
        : defaultRoadmapSettings(board)
    : null;
  const url = published ? `${window.location.origin}${published.path}` : null;
  // The chosen card types whose cards would not show a vote: no Votes field, or none on the card.
  const lackVotes =
    settings?.voting && cardTypes
      ? settings.types.flatMap((id) => {
          const type = cardTypes.types.find((t) => t.id === id);
          return type && !typeShowsVotes(type) ? [type] : [];
        })
      : [];

  // Votes for every chosen type that lacks it, as one change to the plan's card types (one undo step).
  function addVotes() {
    if (!cardTypes?.catalogue || lackVotes.length === 0) return;
    const catalogue = cardTypes.catalogue;
    const ids = new Set(lackVotes.map((t) => t.id));
    cardTypes.saveCatalogue({
      ...catalogue,
      types: withInheritance(catalogue.types.map((t) => (ids.has(t.id) ? withVotesShown(t) : t))),
    });
    setVotesAdded(namesOf(lackVotes.map((t) => t.label)));
  }

  const putRoadmap = (roadmap: PublishedRoadmap) =>
    setData((d) =>
      d
        ? {
            ...d,
            roadmaps: [...d.roadmaps.filter((r) => r.boardId !== roadmap.boardId), roadmap],
          }
        : d,
    );

  async function publish() {
    if (!board || !settings) return;
    let toSave = settings;
    if (formPending) {
      const code = await makeForm();
      if (!code) return;
      toSave = { ...settings, formCode: code };
    }
    setBusy(true);
    setSaveFailed(false);
    try {
      const { roadmap } = await saveRoadmap(scope, board.id, toSave);
      track('Plan', 'Created', 'Roadmap');
      putRoadmap(roadmap);
    } catch {
      setSaveFailed(true);
    }
    setBusy(false);
  }

  // Before publishing a change only moves the draft; once published it saves at once, keeping the link, and goes
  // back if the save fails.
  async function change(next: RoadmapSettings) {
    if (!board) return;
    setSaveFailed(false);
    if (!published) {
      setBoardId(board.id);
      setDraft(next);
      return;
    }
    if (!settingsReady(next)) return;
    const before = published;
    putRoadmap({ ...published, ...next });
    try {
      const { roadmap } = await saveRoadmap(scope, board.id, next);
      track('Plan', 'Changed', 'Roadmap');
      putRoadmap(roadmap);
    } catch {
      putRoadmap(before);
      setSaveFailed(true);
    }
  }

  async function unpublish() {
    if (!board) return;
    setConfirming(null);
    setBusy(true);
    setSaveFailed(false);
    try {
      await unpublishRoadmap(scope, board.id);
      track('Plan', 'Ended', 'Roadmap');
      setDraft(published ? settingsOf(published) : null);
      setBoardId(board.id);
      setData((d) =>
        d ? { ...d, roadmaps: d.roadmaps.filter((r) => r.boardId !== board.id) } : d,
      );
    } catch {
      setSaveFailed(true);
    }
    setBusy(false);
  }

  // Create Suggestion Form (public-roadmap.md "Suggest an Idea"): a form on a new tab whose cards wait in the board's
  // first hidden column, published, then chosen here; the page stays open throughout.
  const newForm = editor?.forms.newSuggestionForm;
  const hidden =
    board && settings ? board.columns.find((c) => !settings.columns.includes(c.status)) : undefined;
  // Makes the form and answers its code, or null (the problem is shown).
  async function makeForm(): Promise<string | null> {
    if (!board || !settings || !newForm || !hidden || !data || making.current) return null;
    making.current = true;
    const typeId = settings.types[0] ?? board.types[0]?.id;
    if (!typeId) return null;
    let code: string | null = null;
    setMakingForm(true);
    setFormProblem(null);
    try {
      const tabId = newForm({ boardElementId: board.id, status: hidden.status, typeId });
      if (!tabId) throw new Error('not_ready');
      // The api reads the stored form, so the new tab must be saved first: the save is queued a beat after the edit,
      // so a refusal means not yet, tried again until it lands (12 s at most).
      const deadline = Date.now() + 12_000;
      for (;;) {
        await new Promise((r) => setTimeout(r, 400));
        if (hasUnsavedWork() && Date.now() < deadline) continue;
        try {
          await apiPublishForm(scope.ownerId, scope.projectId, tabId, null);
          break;
        } catch (e) {
          if (Date.now() >= deadline) throw e;
        }
      }
      const before = new Set(data.forms.map((f) => f.code));
      const next = await readRoadmaps(scope);
      setData(next);
      const made = next.forms.find((f) => !before.has(f.code));
      if (!made) throw new Error('not_listed');
      code = made.code;
      // Counted where the form is made (Form·Created·Roadmap, useFormActions).
      setFormPending(false);
    } catch {
      setFormProblem('Couldn’t make the form. Try again in a moment.');
    }
    setMakingForm(false);
    making.current = false;
    return code;
  }

  // The dropdown's Create a Suggestion Form: on a roadmap already out it is made at once; otherwise on Publish.
  async function chooseCreate(on: boolean) {
    setFormProblem(null);
    if (!on || !published || !settings) {
      setFormPending(on);
      return;
    }
    const code = await makeForm();
    if (code) await change({ ...settings, formCode: code });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      flash();
      track('Plan', 'Copied', 'Roadmap');
    } catch {
      // No clipboard (an insecure context, a refused permission): the field is selected to copy by hand.
      const field = document.getElementById(fieldId) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    }
  }

  const state = !data
    ? readFailed
      ? 'error'
      : 'loading'
    : !board
      ? 'no-board'
      : !board.publishable
        ? 'unpublishable'
        : published
          ? 'published'
          : 'draft';

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={roadmapHeroArt}
        titleId={titleId}
        title="Publish as Roadmap"
        onClose={onClose}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-roadmap-dialog-state={state}
      >
        {state === 'loading' ? <RoadmapSkeleton /> : null}
        {state === 'error' ? (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">
              Couldn’t load your roadmap.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReadFailed(false);
                void read();
              }}
            >
              Try Again
            </Button>
          </div>
        ) : null}
        {state === 'no-board' ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            This plan has no saved board to publish yet. Try again in a moment.
          </p>
        ) : null}
        {/* Where it comes from (owner, 2026-11-17): the tabs holding a board as pills, then the tab's boards when it
            has several; a published one wears a green dot. */}
        {tabs.length > 1 || boards.length > 1 ? (
          <section
            aria-label="Board to publish"
            className="flex flex-col gap-2.5"
            data-roadmap-source=""
          >
            {tabs.length > 1 && tab ? (
              <div className="flex flex-col gap-1.5" data-roadmap-tab-picker="">
                <span className={PICK_HEADING}>Tab</span>
                <ChoicePills
                  label="Tab"
                  data="roadmap-tab"
                  disabled={busy}
                  pills={tabs.map((t) => ({
                    id: t.id,
                    label: t.name,
                    icon: <BoardGlyph />,
                    aside: publishedOn(t.id) ? <PublishedDot /> : undefined,
                  }))}
                  pressed={(id) => id === tab.id}
                  onPick={(id) => {
                    setTabId(id);
                    setFormPending(false);
                    setBoardId(null);
                    setDraft(null);
                    setSaveFailed(false);
                  }}
                />
              </div>
            ) : null}
            {boards.length > 1 && board ? (
              <div className="flex flex-col gap-1.5">
                <span className={PICK_HEADING}>Board</span>
                <ChoicePills
                  label="Board"
                  data="roadmap-board"
                  disabled={busy}
                  pills={boards.map((b) => ({
                    id: b.id,
                    label: b.title || b.tabName,
                    aside: data?.roadmaps.some((r) => r.boardId === b.id) ? (
                      <PublishedDot />
                    ) : undefined,
                  }))}
                  pressed={(id) => id === board.id}
                  onPick={(id) => {
                    setBoardId(id);
                    setFormPending(false);
                    setDraft(null);
                    setSaveFailed(false);
                  }}
                />
              </div>
            ) : null}
          </section>
        ) : null}
        {state === 'unpublishable' ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            This board has no columns to publish.
          </p>
        ) : null}
        {state === 'published' && url ? (
          <div className="flex flex-col gap-2.5" data-roadmap-link="">
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <GlobeIcon />
              Your roadmap is live.
            </p>
            <div className="flex items-center gap-2">
              <input
                id={fieldId}
                readOnly
                aria-label="Roadmap link"
                value={url}
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                className={LINK_FIELD}
              />
              <Button size="sm" onClick={() => void copy()} className="shrink-0">
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
            <span role="status" className="sr-only">
              {copied ? 'Roadmap link copied' : ''}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener"
              className={`${buttonClassName({ variant: 'secondary', size: 'xs' })} self-start`}
            >
              <ExternalIcon />
              Open Roadmap
            </a>
          </div>
        ) : null}
        {(state === 'draft' || state === 'published') && board && settings && data ? (
          <RoadmapSettingsForm
            key={board.id}
            board={board}
            forms={data.forms}
            settings={settings}
            disabled={busy || makingForm}
            createForm={
              newForm
                ? {
                    pending: formPending,
                    choose: (on: boolean) => void chooseCreate(on),
                    busy: makingForm,
                    problem: formProblem,
                    hiddenColumn: hidden?.name ?? null,
                  }
                : undefined
            }
            onChange={(next) => void change(next)}
            votes={
              lackVotes.length > 0
                ? { kind: 'offer', names: namesOf(lackVotes.map((t) => t.label)), add: addVotes }
                : votesAdded && settings.voting
                  ? { kind: 'added', names: votesAdded }
                  : null
            }
          />
        ) : null}
        {state === 'draft' || state === 'published' ? (
          <p
            className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
            data-roadmap-privacy=""
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              <LockIcon />
            </span>
            <span>
              Anyone with the link can see the chosen columns, card types and fields. People,
              comments and other fields are never shown.
            </span>
          </p>
        ) : null}
        {saveFailed ? (
          <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            Couldn’t save. Try again.
          </p>
        ) : null}
      </div>
      {state === 'draft' || state === 'published' ? (
        // The tools' one footer look (owner, 2026-11-17): full width, pinned at the foot, the main action last.
        <ToolFooter>
          {state === 'draft' ? (
            <ToolFooterButton
              busy={busy || makingForm}
              disabled={!settings || !settingsReady(settings)}
              onClick={() => void publish()}
            >
              Publish Roadmap
            </ToolFooterButton>
          ) : null}
          {state === 'published' ? (
            <>
              <ToolFooterButton
                variant="secondary"
                busy={busy}
                onClick={(e) => setConfirming(e.currentTarget)}
              >
                Unpublish
              </ToolFooterButton>
              <ToolFooterButton onClick={onClose}>Done</ToolFooterButton>
            </>
          ) : null}
        </ToolFooter>
      ) : null}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming}
          message="Unpublish this roadmap?"
          warning="Its link stops working at once. Publishing again makes a new link."
          confirmLabel="Unpublish"
          onConfirm={() => void unpublish()}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </Dialog>
  );
}

const BAR = 'animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60';
const BOX = 'animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70';

/** Loading, in the settings' own shape (Title, Columns, Fields, the privacy note and the footer's room), so a roadmap
 *  not yet published does not shrink while it loads and grow when its settings arrive (owner, 2026-11-17). */
function RoadmapSkeleton() {
  return (
    <div aria-busy="true" data-roadmap-skeleton="" className="flex flex-col gap-5">
      <span className="sr-only">Loading your roadmap</span>
      <div className="flex flex-col gap-1.5">
        <div className={`h-3 w-12 ${BAR}`} />
        <div className={`h-9 ${BOX}`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={`h-3 w-16 ${BAR}`} />
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`h-9 ${BOX}`} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={`h-3 w-14 ${BAR}`} />
        <div className={`h-9 ${BOX}`} />
      </div>
      <div className={`h-14 ${BOX}`} />
      {/* The footer's room: Publish shows under the body once loaded. */}
      <div className="h-12" />
    </div>
  );
}

const PICK_HEADING =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const BoardGlyph = lucideGlyph(lucideSquareKanban, 14);

/** A board already out as a roadmap. */
function PublishedDot() {
  return (
    <span
      role="img"
      aria-label="published"
      className="ml-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400"
    />
  );
}
