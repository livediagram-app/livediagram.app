'use client';

// The `@` suggestion list for a comment composer (docs/specs/012-collaboration/comment-mentions.md "Writing a
// mention"). Framework-light on purpose: the composer keeps its own draft;
// this watches the text before the caret for an `@query`, filters the
// candidates, and on a pick rewrites the query to `@handle ` and remembers
// who was picked, so the send can keep the mentions still in the text.

import { useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import { mentionsInText, type CommentMention } from '@livediagram/document';
import type { MentionScope } from '@/components/canvas/collab/comment/MentionContext';
import type { MentionCandidate } from '@/hooks/collab/useCommentMentions';

// How many suggestions show at once.
const MENTION_SUGGESTIONS_MAX = 6;
export const MENTION_UNAVAILABLE_HINT = 'Mention teammates on a team document';

type Field = HTMLInputElement | HTMLTextAreaElement;

// The `@query` the caret sits at the end of, or null. An `@` counts only at
// the start of the field or after whitespace, so an email address never
// opens the list.
export function mentionQueryAt(
  value: string,
  caret: number,
): { start: number; text: string } | null {
  const before = value.slice(0, caret);
  const hit = /(^|\s)@([a-z0-9-]*)$/i.exec(before);
  if (!hit) return null;
  return { start: caret - hit[2]!.length - 1, text: hit[2]!.toLowerCase() };
}

// Candidates for a query: handle prefix, or any word of the name.
export function matchCandidates(
  candidates: readonly MentionCandidate[],
  query: string,
): MentionCandidate[] {
  return candidates
    .filter(
      (c) =>
        c.handle.startsWith(query) ||
        c.name
          .toLowerCase()
          .split(/\s+/)
          .some((w) => w.startsWith(query)),
    )
    .slice(0, MENTION_SUGGESTIONS_MAX);
}

export function useMentionAutocomplete({
  value,
  setValue,
  scope,
  fieldRef,
}: {
  value: string;
  setValue: (next: string) => void;
  scope: MentionScope;
  fieldRef: RefObject<Field | null>;
}) {
  const [caret, setCaret] = useState<number | null>(null);
  // The `@` position the user dismissed with Esc; the list stays shut for it.
  const [dismissed, setDismissed] = useState<number | null>(null);
  // The highlighted row. Typing (onType) starts it from the top again; the
  // caret tracking that follows every key release and click leaves it alone,
  // or the key-up after an arrow press would undo the press.
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<CommentMention[]>([]);

  const query = caret === null ? null : mentionQueryAt(value, caret);
  const live = query !== null && query.start !== dismissed;
  const queryText = live && query ? query.text : null;
  const items = useMemo(
    () => (queryText === null ? [] : matchCandidates(scope.candidates, queryText)),
    [queryText, scope.candidates],
  );
  const hint = live && !scope.available ? MENTION_UNAVAILABLE_HINT : null;
  const open = items.length > 0 || hint !== null;
  const active = Math.min(highlight, Math.max(0, items.length - 1));

  const pick = (index: number) => {
    const c = items[index];
    if (!c || !query || caret === null) return;
    const insert = `@${c.handle} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    const at = query.start + insert.length;
    setValue(next);
    setCaret(at);
    setHighlight(0);
    const { pending: _pending, ...mention } = c;
    setPicked((cur) => [...cur, mention]);
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(at, at);
    });
  };

  // Returns true when the key was the list's (the composer must not also
  // act on it: Enter picks rather than sends while the list is open).
  const onKeyDown = (e: KeyboardEvent<Field>): boolean => {
    if (!open || !query) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDismissed(query.start);
      return true;
    }
    if (items.length === 0) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((active + step + items.length) % items.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(active);
      return true;
    }
    return false;
  };

  // Keep the caret in step with the field (clicks, key releases). Only the
  // caret: see the highlight above.
  const track = (e: { currentTarget: Field }) => {
    setCaret(e.currentTarget.selectionStart);
  };
  // The field's text changed: follow the caret and start the list afresh.
  const onType = (e: { currentTarget: Field }) => {
    track(e);
    setHighlight(0);
  };

  // On send: the mentions still in the text, and a fresh start.
  const take = (text: string): CommentMention[] => {
    const kept = mentionsInText(text, picked);
    setPicked([]);
    setDismissed(null);
    return kept;
  };

  return {
    open,
    items,
    highlight: active,
    hint,
    pick,
    onKeyDown,
    onType,
    bind: { onSelect: track, onClick: track, onKeyUp: track },
    take,
  };
}
