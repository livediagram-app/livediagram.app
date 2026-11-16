// Who is suggesting, as whom (docs/specs/007-editor/suggestions.md "Suggesting", "Suggest Only"): the person's mode
// (Editing or Suggesting, for every article on the tab while the editor is open), whether the room has put this
// session on Suggest Only, and the author a suggestion carries (the session's collab key, name and colour). Also
// the assistant suggestions to toast, and the requests to bring a suggestion into view. A small external store,
// read with useSyncExternalStore and, by the writing's transaction path, synchronously.
import { useSyncExternalStore } from 'react';

export type SuggestMode = 'editing' | 'suggesting';
export type SuggestAuthor = { by: string; n: string; c?: string };

type State = { mode: SuggestMode; suggestOnly: boolean; author: SuggestAuthor | null };

let state: State = { mode: 'editing', suggestOnly: false, author: null };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};

export function setSuggestMode(mode: SuggestMode): void {
  if (state.mode !== mode) set({ mode });
}

/** The room's word on this session (a system `review` op): a Participant on Suggest Only always suggests. */
export function setSuggestOnly(on: boolean): void {
  if (state.suggestOnly !== on) set({ suggestOnly: on });
}

export function setSuggestAuthor(author: SuggestAuthor | null): void {
  const was = state.author;
  if (was?.by === author?.by && was?.n === author?.n && was?.c === author?.c) return;
  set({ author });
}

export const useSuggestMode = (): SuggestMode =>
  useSyncExternalStore(
    subscribe,
    () => state.mode,
    () => 'editing',
  );

export const useSuggestOnly = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => state.suggestOnly,
    () => false,
  );

/** Whether the room has put this session on Suggest Only. */
export const suggestOnlyNow = (): boolean => state.suggestOnly;

/** Whether this person's changes to the writing are suggestions right now. */
export const suggestingNow = (): boolean => state.suggestOnly || state.mode === 'suggesting';

/** The author a suggestion made now carries, or null when this person is not suggesting. */
export function suggestAuthorNow(): SuggestAuthor | null {
  return suggestingNow() && state.author?.by ? state.author : null;
}

/** This session's collab key, as suggestions carry it. */
export const suggestAuthorKey = (): string | null => state.author?.by ?? null;

/** Back to the start (a test, or a document closed). */
export function resetSuggestState(): void {
  state = { mode: 'editing', suggestOnly: false, author: null };
  pendingReview = null;
  emit();
}

// ---------- An assistant's suggestions arriving, and requests to review --------------------------------------

/** An assistant's write as suggestions, as its article frame announced it. */
export type SuggestedNotice = { tabId: string; flow: string; n: string; count: number; g: string };

const suggestedListeners = new Set<(n: SuggestedNotice) => void>();

export function announceSuggested(notice: SuggestedNotice): void {
  for (const l of suggestedListeners) l(notice);
}

export function onSuggested(l: (n: SuggestedNotice) => void): () => void {
  suggestedListeners.add(l);
  return () => void suggestedListeners.delete(l);
}

// A request to bring the first suggestion of a change (or any) into view with its card open. Kept until the
// article's writing takes it, so a request made before the article is on screen (its tab still opening) lands too.
export type ReviewRequest = { flow: string; g: string | null };
const reviewListeners = new Set<(r: ReviewRequest) => void>();
let pendingReview: ReviewRequest | null = null;

export function requestSuggestionReview(flow: string, g: string | null = null): void {
  pendingReview = { flow, g };
  for (const l of reviewListeners) l(pendingReview);
}

/** The pending request for `flow`, taken (so it lands once), or null. */
export function takeSuggestionReview(flow: string): ReviewRequest | null {
  if (pendingReview?.flow !== flow) return null;
  const r = pendingReview;
  pendingReview = null;
  return r;
}

export function onSuggestionReview(l: (r: ReviewRequest) => void): () => void {
  reviewListeners.add(l);
  return () => void reviewListeners.delete(l);
}

// ---------- The notice for a change that has no suggestion form --------------------------------------------

const NOTICE_GAP_MS = 2500;
let lastNotice = 0;
let toast: ((message: string) => void) | null = null;

export const SUGGEST_REFUSED_NOTICE =
  'Suggesting changes words and their formatting. Switch to Editing to change this.';
export const SUGGEST_ONLY_REFUSED_NOTICE =
  'Your changes here are suggestions: words and their formatting.';

/** Where the notice goes: the editor's toast, set once it mounts. */
export function setSuggestToast(next: ((message: string) => void) | null): void {
  toast = next;
}

/** Says `message` to whoever is reviewing (how many suggestions wait in held paragraphs). */
export function sayToReviewer(message: string): void {
  toast?.(message);
}

/** Says what suggesting can change, at most once in NOTICE_GAP_MS. */
export function announceSuggestRefused(now = Date.now()): void {
  if (now - lastNotice < NOTICE_GAP_MS) return;
  lastNotice = now;
  toast?.(state.suggestOnly ? SUGGEST_ONLY_REFUSED_NOTICE : SUGGEST_REFUSED_NOTICE);
}
