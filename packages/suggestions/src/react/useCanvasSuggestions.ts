'use client';

// Suggestions in one editor (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md): the person's mode
// (Editing or Suggesting), the active tab's suggestions read from the api and read again whenever the room says they
// changed, the change being gathered sent as a suggestion, and the review's Accept, Reject, Accept All and Reject
// All. Each product's editor composes it in a slice of its own, handing in its client, its role and its notices.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SuggestCapture, CaptureTab } from '../capture';
import type { Decision, SuggestionsClient } from '../client';
import { onSuggestionsChanged, setSelfSuggesting } from '../room-signal';
import type { SuggestionLevel } from '../route';
import type {
  CanvasSuggestion,
  SuggestionAuthor,
  SuggestionElement,
  SuggestionOp,
} from '../suggestion';
import type { CanvasSuggestionType } from '../telemetry';
import { createSuggestionsStore, type SuggestionsStore } from './suggestions-store';
import type { SuggestBridge } from './useSuggestCapture';

export type SuggestMode = 'editing' | 'suggesting';

// What the editor says, in its toast (blueprint "Presentation and UX", final copy).
export const SUGGEST_REFUSED_NOTICE =
  'Suggesting changes what is on this tab. Switch to Editing to change this.';
export const SUGGEST_ONLY_REFUSED_NOTICE =
  'Your changes here are suggestions: what is on this tab, never its settings.';
export const SUGGEST_FAILED_NOTICE = 'Your suggestion could not be sent. Try again.';
export const ACCEPT_CONFLICT_NOTICE =
  'The canvas changed since that suggestion was made, so it was not applied. Check it and suggest again.';
export const ACCEPT_PARTLY_NOTICE = (n: number) =>
  `${n === 1 ? 'One suggestion was' : `${n} suggestions were`} not applied: the canvas changed since.`;
// At most one refusal notice in this long: a drag the tab can't hold says so once.
const REFUSED_NOTICE_GAP_MS = 2500;
const NONE: readonly never[] = [];

export type CanvasSuggestionsInput<T extends CaptureTab<E>, E extends SuggestionElement> = {
  // Null where there is no api to suggest through (a This Browser document, an embed): suggestions are off.
  client: SuggestionsClient<E> | null;
  tabId: string;
  level: SuggestionLevel;
  // The room's word: a Participant on Suggest Only always suggests.
  suggestOnly: boolean;
  self: SuggestionAuthor | null;
  capture: SuggestCapture<T, E>;
  connect: (bridge: SuggestBridge<E> | null) => void;
  notify: (message: string) => void;
  // Telemetry, as `Element·Changed` with one of these types, never content.
  track: (type: CanvasSuggestionType) => void;
};

export type CanvasSuggestions<E extends SuggestionElement> = {
  store: SuggestionsStore<E>;
  // Whether the bar shows: a Viewer, and an editor with no api, see no suggestion.
  enabled: boolean;
  mode: SuggestMode;
  setMode: (mode: SuggestMode) => void;
  // Suggesting right now: an Editor in Suggesting mode, or a Participant on Suggest Only.
  suggesting: boolean;
  suggestOnly: boolean;
  level: SuggestionLevel;
  selfKey: string | null;
  suggestions: readonly CanvasSuggestion<E>[];
  busy: boolean;
  accept: (decision: Decision) => Promise<void>;
  reject: (decision: Decision) => Promise<void>;
  focus: (id: string | null) => void;
};

export function useCanvasSuggestions<T extends CaptureTab<E>, E extends SuggestionElement>(
  input: CanvasSuggestionsInput<T, E>,
): CanvasSuggestions<E> {
  const { client, tabId, level, suggestOnly, self, capture, connect, notify, track } = input;
  const enabled = client !== null && level !== 'view';
  const [mode, setModeState] = useState<SuggestMode>('editing');
  const suggesting = enabled && (suggestOnly || (level === 'edit' && mode === 'suggesting'));
  // Held with the tab they belong to, so another tab's never show while its own load.
  const [held, setHeld] = useState<{ tabId: string; list: readonly CanvasSuggestion<E>[] }>({
    tabId,
    list: NONE,
  });
  const suggestions =
    enabled && held.tabId === tabId ? held.list : (NONE as readonly CanvasSuggestion<E>[]);
  const [busy, setBusy] = useState(false);
  const [store] = useState(() => createSuggestionsStore<E>());
  const tabRef = useRef(tabId);
  useLayoutEffect(() => {
    tabRef.current = tabId;
  }, [tabId]);
  const lastRefusal = useRef(0);

  const load = useCallback(
    async (forTab: string) => {
      if (!client || !enabled) return;
      try {
        const list = await client.list(forTab);
        if (tabRef.current === forTab) setHeld({ tabId: forTab, list });
      } catch {
        // The bar keeps what it showed; the next change the room announces reads again.
      }
    },
    [client, enabled],
  );

  useEffect(() => {
    if (!enabled || !client) return;
    // The first read, then each one the room's word asks for.
    let live = true;
    client
      .list(tabId)
      .then((list) => {
        if (live) setHeld({ tabId, list });
      })
      .catch(() => {});
    const stop = onSuggestionsChanged((changed) => {
      if (changed === tabRef.current) void load(changed);
    });
    return () => {
      live = false;
      stop();
    };
  }, [enabled, client, tabId, load]);

  // Where the capture's gathered change goes, and whether it gathers at all.
  useEffect(() => {
    connect({
      suggestingOn: () => (suggesting ? tabRef.current : null),
      propose: (forTab: string, ops: SuggestionOp<E>[]) => {
        if (!client) return;
        void client
          .submit(forTab, ops)
          .then((made) => {
            if (tabRef.current === forTab)
              setHeld((was) => ({
                tabId: forTab,
                list: [
                  ...(was.tabId === forTab ? was.list : NONE).filter((s) => s.id !== made.id),
                  made,
                ],
              }));
            track(suggestOnly ? 'CanvasSuggestionSuggestOnly' : 'CanvasSuggestionMade');
          })
          .catch(() => notify(SUGGEST_FAILED_NOTICE));
      },
      refuse: () => {
        const now = Date.now();
        if (now - lastRefusal.current < REFUSED_NOTICE_GAP_MS) return;
        lastRefusal.current = now;
        notify(suggestOnly ? SUGGEST_ONLY_REFUSED_NOTICE : SUGGEST_REFUSED_NOTICE);
      },
    });
    return () => connect(null);
  }, [connect, client, suggesting, suggestOnly, notify, track]);

  // Turning Suggesting off sends what was gathered first: nothing typed is lost.
  useEffect(() => {
    if (!suggesting) capture.flush();
  }, [suggesting, capture]);

  // The overlay's view: the tab's suggestions, and the draft as the capture gathers it.
  useEffect(() => {
    store.set({ tabId, suggestions, self });
  }, [store, tabId, suggestions, self]);
  useEffect(() => capture.subscribe(() => store.set({ draft: capture.draft() })), [capture, store]);

  // An Editor's own Suggesting mode, for the title bar's role pill (it reads Suggesting, as a Participant's on
  // Suggest Only does).
  const selfSuggesting = suggesting && !suggestOnly;
  useEffect(() => {
    setSelfSuggesting(selfSuggesting);
    return () => setSelfSuggesting(false);
  }, [selfSuggesting]);

  const setMode = useCallback(
    (next: SuggestMode) => {
      setModeState(next);
      track(next === 'suggesting' ? 'CanvasSuggesting' : 'CanvasEditing');
    },
    [track],
  );

  const decide = useCallback(
    async (action: 'accept' | 'reject', decision: Decision) => {
      if (!client) return;
      const forTab = tabRef.current;
      setBusy(true);
      try {
        if (action === 'accept') {
          const answer = await client.accept(forTab, decision);
          if (!answer.ok) notify(ACCEPT_CONFLICT_NOTICE);
          else if (answer.conflicts.length > 0)
            notify(ACCEPT_PARTLY_NOTICE(answer.conflicts.length));
          track('all' in decision ? 'CanvasSuggestionsAcceptedAll' : 'CanvasSuggestionAccepted');
        } else {
          await client.reject(forTab, decision);
          track('all' in decision ? 'CanvasSuggestionsRejectedAll' : 'CanvasSuggestionRejected');
        }
      } catch {
        notify('That could not be done. Try again.');
      } finally {
        setBusy(false);
        await load(forTab);
      }
    },
    [client, load, notify, track],
  );

  const focus = useCallback((id: string | null) => store.set({ focused: id }), [store]);

  return useMemo(
    () => ({
      store,
      enabled,
      mode,
      setMode,
      suggesting,
      suggestOnly: enabled && suggestOnly,
      level,
      selfKey: self?.key ?? null,
      suggestions,
      busy,
      accept: (d: Decision) => decide('accept', d),
      reject: (d: Decision) => decide('reject', d),
      focus,
    }),
    [
      store,
      enabled,
      mode,
      setMode,
      suggesting,
      suggestOnly,
      level,
      self,
      suggestions,
      busy,
      decide,
      focus,
    ],
  );
}
