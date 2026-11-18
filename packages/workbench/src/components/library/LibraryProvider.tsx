'use client';

// The Library every editor shares (liveworkspace/docs/specs/006-media/libraries.md): one provider per editor holding
// the person's Personal and team items, loaded the first time something needs them (the palette's Library opening, or
// Save to Library), again on each Save to Library opening and after each change, the Save to Library dialog, and the calls the palette's Library makes.
// Nothing is fetched for an editor session that never opens either. An app without the Library (no api) mounts none, and
// every consumer reads null.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { LibraryItemSummary, LibraryTeam } from '@liveworkspace/media';
import type { LibraryInsertItem } from '../../hooks/canvas/useLibraryItemInsert';
import { libraryErrorMessage, type LibraryApi } from '../../lib/library/library-api';
import type { LibraryGroup } from '../../lib/library/library-groups';
import { libraryPictures, type LibraryPictureSource } from '../../lib/library/library-pictures';
import { SaveToLibraryDialog, type SaveToLibraryChoice } from './SaveToLibraryDialog';

// An item the editor holds itself (livediagram's own shape libraries), placed without a request.
export type LocalLibraryItem = { summary: LibraryItemSummary; elements: readonly unknown[] };

// 'idle' until something first needs the list.
export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LibraryState = {
  status: LibraryStatus;
  items: LibraryItemSummary[];
  teams: LibraryTeam[];
  hidden: number;
  legacyWritable: boolean;
};

// What a save starts from: a selection already copied to the origin, and a name to suggest.
export type LibrarySaveDraft = LibraryInsertItem<unknown> & { suggestedTitle: string };

export type LibraryContextValue = {
  state: LibraryState;
  // The last refusal, in words, until the next action.
  notice: string | null;
  reload: () => void;
  // Loads the list the first time it is called; later calls do nothing.
  ensureLoaded: () => void;
  requestSave: (draft: LibrarySaveDraft) => void;
  place: (item: LibraryItemSummary) => Promise<LibraryInsertItem<unknown> | null>;
  rename: (item: LibraryItemSummary, title: string) => Promise<boolean>;
  renameFolder: (group: LibraryGroup, from: string, to: string) => Promise<boolean>;
  remove: (item: LibraryItemSummary) => Promise<boolean>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

/** The Library, or null in an editor that has none. */
export function useLibrary(): LibraryContextValue | null {
  return useContext(LibraryContext);
}

const EMPTY: LibraryState = {
  status: 'idle',
  items: [],
  teams: [],
  hidden: 0,
  legacyWritable: false,
};

type LibraryProviderProps = {
  api: LibraryApi | null;
  localItems?: readonly LocalLibraryItem[];
  // Told after each save, with where it went (for the app's own telemetry).
  onSaved?: (scope: 'personal' | 'team') => void;
  // Told after each place the door answered (a click or a drop), with whose library it came from (the same).
  onPlaced?: (scope: 'personal' | 'team') => void;
  // Where the editor shows a picture from, so a save sends its small copies for the tile (libraries.md "Pictures").
  pictures?: LibraryPictureSource;
  children: React.ReactNode;
};

export function LibraryProvider(props: LibraryProviderProps) {
  // One element type whether or not there is an api, so the editor below never remounts when the api arrives (an
  // owner resolving after load) or goes.
  return <LoadedLibraryProvider {...props} />;
}

function LoadedLibraryProvider({
  api,
  localItems,
  onSaved,
  onPlaced,
  pictures,
  children,
}: LibraryProviderProps) {
  const [remote, setRemote] = useState<LibraryState>(EMPTY);
  const [copied, setCopied] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<LibrarySaveDraft | null>(null);
  const loadSeq = useRef(0);

  const reload = useCallback(() => {
    if (!api) return;
    const seq = ++loadSeq.current;
    setRemote((s) => (s.status === 'ready' ? s : { ...s, status: 'loading' }));
    api.list().then(
      (list) => {
        if (seq !== loadSeq.current) return;
        setCopied(new Set(list.legacy.copied));
        setRemote({
          status: 'ready',
          items: list.items,
          teams: list.teams,
          hidden: list.hidden,
          legacyWritable: list.legacy.writable,
        });
      },
      (error: unknown) => {
        if (seq !== loadSeq.current) return;
        console.warn('[library] list failed', { error: String(error) });
        setRemote((s) => ({ ...s, status: 'error' }));
      },
    );
  }, [api]);

  // Loaded once per api: a new one (another owner) loads afresh on its first need.
  const askedFor = useRef<LibraryApi | null>(null);
  const ensureLoaded = useCallback(() => {
    if (!api || askedFor.current === api) return;
    askedFor.current = api;
    reload();
  }, [api, reload]);

  // The editor's own shape libraries join Personal, less those the Library has already copied.
  const local = useMemo(
    () => (localItems ?? []).filter((l) => !copied.has(l.summary.legacy?.libraryId ?? '')),
    [localItems, copied],
  );
  const state = useMemo<LibraryState>(
    () =>
      local.length === 0
        ? remote
        : { ...remote, items: [...remote.items, ...local.map((l) => l.summary)] },
    [remote, local],
  );

  // Each action clears the last notice, and a refusal sets the next.
  const attempt = useCallback(
    async <T,>(run: () => Promise<T>, reloads = true): Promise<T | null> => {
      setNotice(null);
      try {
        const value = await run();
        if (reloads) reload();
        return value;
      } catch (error) {
        console.warn('[library] action refused', { error: String(error) });
        setNotice(libraryErrorMessage(error));
        return null;
      }
    },
    [reload],
  );

  const place = useCallback(
    async (item: LibraryItemSummary) => {
      const held = local.find((l) => l.summary.id === item.id);
      const placed = held
        ? { width: item.width, height: item.height, elements: held.elements }
        : api
          ? await attempt(() => api.place(item.id), false)
          : null;
      if (placed) onPlaced?.(item.scope);
      return placed;
    },
    [api, attempt, local, onPlaced],
  );

  const value = useMemo<LibraryContextValue | null>(
    () =>
      api && {
        state,
        notice,
        reload,
        ensureLoaded,
        requestSave: (next) => {
          // The dialog's team list and folder suggestions come from the list, asked afresh on each opening so a team
          // joined since the palette first loaded is offered (one ask per opening, never a poll).
          askedFor.current = api;
          reload();
          setNotice(null);
          setDraft(next);
        },
        place,
        rename: async (item, title) => (await attempt(() => api.rename(item.id, title))) !== null,
        renameFolder: async (group, from, to) =>
          (await attempt(() =>
            api.renameFolder({ scope: group.scope, teamId: group.teamId, from, to }),
          )) !== null,
        remove: async (item) =>
          (await attempt(async () => api.remove(item.id).then(() => true))) === true,
      },
    [api, attempt, ensureLoaded, notice, place, reload, state],
  );

  const save = useCallback(
    async (choice: SaveToLibraryChoice) => {
      if (!draft || !api) return;
      // The pictures' small copies for the tile; none when they can't be made, and the save goes on without them.
      const copies = pictures ? await libraryPictures(draft, pictures).catch(() => ({})) : {};
      await api.save({
        scope: choice.scope,
        teamId: choice.teamId,
        folder: choice.folder,
        title: choice.title,
        width: draft.width,
        height: draft.height,
        elements: draft.elements,
        ...(Object.keys(copies).length > 0 ? { pictures: copies } : {}),
      });
      onSaved?.(choice.scope);
      setDraft(null);
      reload();
    },
    [api, draft, onSaved, pictures, reload],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
      <SaveToLibraryDialog
        open={api !== null && draft !== null}
        count={draft?.elements.length ?? 0}
        suggestedTitle={draft?.suggestedTitle ?? ''}
        teams={state.teams}
        items={state.items}
        onClose={() => setDraft(null)}
        onSave={save}
      />
    </LibraryContext.Provider>
  );
}
