'use client';

// Publish as Roadmap (docs/specs/026-plan/public-roadmap.md "The dialog"): a board of the tab as a public page, read
// fresh when it opens, in one of two states. Not published: the settings and Publish Roadmap. Published: the live link
// with Copy Link and Open Roadmap, the settings saving as they change (the link kept), and Unpublish behind a confirm.
// A tab with several boards gets a board picker at the top. The privacy note is always there. With Voting on, a chosen
// card type whose cards would not show their votes is offered Add Votes (one change to the plan's card types).
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { PublishedRoadmap, RoadmapSettings, RoadmapsResponse } from '@liveplanner/api-schema';
import {
  Button,
  ConfirmPopover,
  LoadingSweep,
  Select,
  buttonClassName,
  lucideGlyph,
  useCopiedFlash,
} from '@liveplanner/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { lucideExternalLink, lucideGlobe, lucideLock } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
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
  boardIds,
  cardTypes,
  onClose,
}: {
  scope: RoadmapScope;
  // The Plan boards on the tab, in its order.
  boardIds: readonly string[];
  // The plan's card types and their changes (useItemTypes): what Add Votes reads and changes. Absent: no offer.
  cardTypes?: Pick<ItemTypesSlice, 'catalogue' | 'types' | 'saveCatalogue'> | undefined;
  onClose: () => void;
}) {
  const titleId = useId();
  const pickerId = useId();
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

  // The tab's boards the api knows, in the tab's order (a board just drawn may not be saved yet).
  const boards = useMemo(
    () => (data ? boardIds.flatMap((id) => data.boards.filter((b) => b.id === id)) : []),
    [data, boardIds],
  );
  const board = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;
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
    setBusy(true);
    setSaveFailed(false);
    try {
      const { roadmap } = await saveRoadmap(scope, board.id, settings);
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
        subtitle="A public page of the cards you choose."
        onClose={onClose}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-roadmap-dialog-state={state}
      >
        {state === 'loading' ? (
          <div className="flex h-24 items-center justify-center" aria-busy="true">
            <span className="sr-only">Loading your roadmap</span>
            <LoadingSweep />
          </div>
        ) : null}
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
            This tab has no saved board to publish yet. Try again in a moment.
          </p>
        ) : null}
        {boards.length > 1 && board ? (
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={pickerId}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Board
            </label>
            <Select
              id={pickerId}
              value={board.id}
              disabled={busy}
              onChange={(e) => {
                setBoardId(e.target.value);
                setDraft(null);
                setSaveFailed(false);
              }}
              className="min-w-0 max-w-[65%]"
              selectClassName="w-full truncate"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || b.tabName}
                  {data?.roadmaps.some((r) => r.boardId === b.id) ? ' (published)' : ''}
                </option>
              ))}
            </Select>
          </div>
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
            disabled={busy}
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
        <DialogFooter>
          {state === 'draft' ? (
            <Button
              size="sm"
              busy={busy}
              disabled={!settings || !settingsReady(settings)}
              onClick={() => void publish()}
            >
              Publish Roadmap
            </Button>
          ) : null}
          {state === 'published' ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                busy={busy}
                onClick={(e) => setConfirming(e.currentTarget)}
              >
                Unpublish
              </Button>
              <Button size="sm" onClick={onClose}>
                Done
              </Button>
            </>
          ) : null}
        </DialogFooter>
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
