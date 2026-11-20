'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastStack, type ToastAnswers } from './ToastStack';
import {
  pushToast,
  retireToasts,
  upsertActionToast,
  type ToastAction,
  type ToastActionSpec,
  type ToastEntry,
  type ToastLeft,
  type ToastOffer,
  type ToastTone,
} from './toast-queue';
import {
  TOAST_LIST_OPENED_EVENT,
  currentToastHistoryScope,
  recordToast,
  setToastHistoryScope,
  settleToast,
  toastRecordId,
} from './toast-history';

export type { ToastAction, ToastActionSpec, ToastOffer, ToastTone } from './toast-queue';

// The toast surface (liveworkspace/docs/specs/016-notifications/toasts.md), one for every editor, the Explorer and
// Settings. Two jobs: (1) make otherwise-silent failures visible (a background save, a copy, an upload), and (2)
// confirm consequential, otherwise silent actions (an item moved to the Trash, with Undo). Never for autosave nor for
// what is already on screen.
//
// The imperative API keeps call sites terse:
//
//   catch (e) { toast.error("Couldn't add the tab. Try again."); }
//
// `quiet` (the editors' In-Editor Notifications setting, read fresh per push) keeps info, success, offers and action
// toasts from popping up; warnings, errors, standing toasts and an `important` action toast ignore it. Every toast,
// shown or not, is written to the notification list (toast-history.ts) the footer's bell opens.
//
// One stack per page: a provider inside another (the Explorer panel inside an editor) hands its toasts to the outer
// one, so they share its stack, its list and its `quiet`.

/** One follow-on step on a plain toast (Undo, Reload); pressing it closes the toast. */
export type ToastOptions = {
  action?: Pick<ToastAction, 'label' | 'ariaLabel' | 'onSelect'>;
  // A standing toast: no timeout (a new version is ready, the account is not answering).
  sticky?: boolean;
  // Shown even when notifications are quieted.
  important?: boolean;
  // Closed by the person (the close button or Escape).
  onDismiss?: () => void;
};

export type ToastApi = {
  info: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  offer: (offer: ToastOffer) => void;
  action: (spec: ToastActionSpec) => void;
  // Close the action toast upserted under `key` (an Undo that has run, a standing toast no longer true), if up.
  dismissAction: (key: string) => void;
};

const noop: ToastApi = {
  info: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
  offer: () => {},
  action: () => {},
  dismissAction: () => {},
};

const ToastContext = createContext<ToastApi>(noop);

let nextId = 1;

const ALWAYS_SHOWN: ReadonlySet<ToastTone> = new Set(['warning', 'error']);
const neverQuiet = () => false;

export type ToastProviderProps = {
  children: ReactNode;
  // Whether notifications are quieted right now (read per push); never, when not given.
  quiet?: () => boolean;
  // The notification list this page keeps (toast-history.ts); the page's path when not given.
  historyScope?: () => string;
};

export function ToastProvider(props: ToastProviderProps) {
  const outer = useContext(ToastContext);
  if (outer !== noop) return <>{props.children}</>;
  return <ToastRoot {...props} />;
}

function ToastRoot({ children, quiet = neverQuiet, historyScope }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  // The list as last committed, so a push knows which toast it became (a new one, or one upserted in place) and
  // writes that one to the notification list.
  const list = useRef<ToastEntry[]>([]);
  const commit = useCallback((next: ToastEntry[]) => {
    if (next === list.current) return;
    list.current = next;
    setToasts(next);
  }, []);
  const quietRef = useRef(quiet);
  useEffect(() => {
    quietRef.current = quiet;
  }, [quiet]);

  useEffect(() => {
    if (!historyScope) return;
    setToastHistoryScope(historyScope);
    return () => setToastHistoryScope(null);
  }, [historyScope]);
  // Each write names its list itself: a child's first effect can raise a toast before the effect above has named
  // the page's list, and that toast belongs in it too.
  const scopeRef = useRef(historyScope);
  useEffect(() => {
    scopeRef.current = historyScope;
  }, [historyScope]);
  const scope = useCallback(() => scopeRef.current?.() ?? currentToastHistoryScope(), []);

  // Mark leaving, and settle what left in the list: `seen` when the person closed or answered it, else `missed`.
  const retire = useCallback(
    (match: (t: ToastEntry) => boolean, state: ToastLeft) => {
      const before = list.current;
      const next = retireToasts(before, match, state);
      settleRetired(before, next, state, scope());
      commit(next);
    },
    [commit, scope],
  );

  // Add or upsert, then record the toast it became; a toast pushed out by the limit left unseen.
  const add = useCallback(
    (
      input: { message: string; tone: ToastTone; key?: string },
      shown: boolean,
      write: (prev: ToastEntry[], id: number) => ToastEntry[],
    ) => {
      if (!input.message) return;
      const id = nextId++;
      if (!shown) {
        recordToast({ id: toastRecordId(id), ...input }, 'missed', Date.now(), scope());
        return;
      }
      const before = list.current;
      const next = write(before, id);
      if (next === before) return;
      const entry =
        next.find((t) => t.id === id) ??
        (input.key === undefined ? undefined : next.find((t) => !t.leaving && t.key === input.key));
      if (entry)
        recordToast({ id: toastRecordId(entry.id), ...input }, 'live', Date.now(), scope());
      settleRetired(before, next, 'missed', scope());
      commit(next);
    },
    [commit, scope],
  );

  const push = useCallback(
    (message: string, tone: ToastTone, options: ToastOptions = {}, offer?: ToastOffer) => {
      const shown =
        ALWAYS_SHOWN.has(tone) ||
        options.sticky === true ||
        options.important === true ||
        !quietRef.current();
      const ownId = { current: 0 };
      const action = options.action;
      const actions: ToastAction[] | undefined = action
        ? [
            {
              ...action,
              // A plain toast's action closes it once it has run.
              onSelect: () => {
                action.onSelect();
                retire((t) => t.id === ownId.current, 'seen');
              },
            },
          ]
        : undefined;
      add({ message, tone }, shown, (prev, id) => {
        ownId.current = id;
        return pushToast(
          prev,
          { message, tone, offer, actions, sticky: options.sticky, onDismiss: options.onDismiss },
          id,
        );
      });
    },
    [add, retire],
  );

  const upsertAction = useCallback(
    (spec: ToastActionSpec) => {
      const tone = spec.tone ?? 'info';
      const shown =
        ALWAYS_SHOWN.has(tone) ||
        spec.sticky === true ||
        spec.important === true ||
        !quietRef.current();
      // Taking any of its actions is seeing it.
      const actions = spec.actions.map((a) => ({
        ...a,
        onSelect: () => {
          const live = list.current.find((t) => !t.leaving && t.key === spec.key);
          if (live) settleToast(toastRecordId(live.id), 'seen', scope());
          a.onSelect();
        },
      }));
      add({ message: spec.message, tone, key: spec.key }, shown, (prev, id) =>
        upsertActionToast(prev, { ...spec, actions }, id),
      );
    },
    [add, scope],
  );

  // The list opened: what is passing goes into the bell, seen; a standing toast and an offer (it waits on an answer)
  // stay.
  useEffect(() => {
    const onOpened = () => retire((t) => !t.sticky && !t.offer, 'seen');
    window.addEventListener(TOAST_LIST_OPENED_EVENT, onOpened);
    return () => window.removeEventListener(TOAST_LIST_OPENED_EVENT, onOpened);
  }, [retire]);

  const api = useMemo<ToastApi>(
    () => ({
      info: (msg, options) => push(msg, 'info', options),
      success: (msg, options) => push(msg, 'success', options),
      warning: (msg, options) => push(msg, 'warning', options),
      error: (msg, options) => push(msg, 'error', options),
      offer: (offer) => push(offer.message, 'info', {}, offer),
      action: upsertAction,
      dismissAction: (key) => retire((t) => t.key === key, 'seen'),
    }),
    [push, upsertAction, retire],
  );

  const on = useMemo<ToastAnswers>(() => {
    // An offer is answered once: the toast leaves first, then its callback runs. A closed toast fades where it is
    // and leaves the notification list.
    const answer = (entry: ToastEntry, confirm: boolean, left?: 'closed') => {
      if (entry.leaving) return;
      if (left) entry.onDismiss?.();
      retire((t) => t.id === entry.id, left ?? 'seen');
      if (!entry.offer) return;
      if (confirm) entry.offer.onConfirm();
      else entry.offer.onDecline();
    };
    return {
      answer,
      // Closing is dismissing: answered as dismissed, through the same path as an offer.
      close: (entry) => answer(entry, false, 'closed'),
      expire: (id) => retire((t) => t.id === id, 'missed'),
      remove: (id) => commit(list.current.filter((t) => t.id !== id)),
    };
  }, [retire, commit]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} on={on} />
    </ToastContext.Provider>
  );
}

// Settle, in the notification list, every toast a write marked leaving.
function settleRetired(
  before: ToastEntry[],
  next: ToastEntry[],
  state: ToastLeft,
  scope: string,
): void {
  if (next === before) return;
  const wasLeaving = new Set(before.filter((t) => t.leaving).map((t) => t.id));
  for (const t of next) {
    if (t.leaving && !wasLeaving.has(t.id)) settleToast(toastRecordId(t.id), state, scope);
  }
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
