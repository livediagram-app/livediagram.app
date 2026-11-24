'use client';

// One suggestion's rules (liveworkspace/docs/specs/016-notifications/suggestions.md "Rules"): checked when the page is
// idle, at most every SUGGEST_CHECK_MS while the item is open and visible (and SUGGEST_IDLE_MS after a `wake`), never
// on a keystroke, a drag or a save; shown only while nothing else holds the notice slot, no other suggestion shows, the
// person is not mid-gesture, the switch is on and it was never decided for the item. Taken or dismissed, it is decided
// for the item and the checks stop.
import { useCallback, useEffect, useRef, useState } from 'react';
import { workbench } from '../../bindings';
import { noticeSlotHeld } from '../../lib/notice-slot';
import { busyNow, watchActivity } from './suggest-activity';
import { decideSuggestion, maySuggest, turnOffSuggestion } from './suggest-memory';
import { SUGGESTIONS, SUGGEST_CHECK_MS, SUGGEST_IDLE_MS, type SuggestionId } from './suggestions';

/** What a check found: the line saying why now, and the one click. */
export type SuggestionFind = { line: string; run: () => void | Promise<unknown> };

/** A trigger's check: reads what the editor holds; a promise only once the cheap part found something. */
export type SuggestionCheck = () => SuggestionFind | null | Promise<SuggestionFind | null>;

// The suggestion on show on this page, so two never show at once.
let showing: SuggestionId | null = null;

/** Whether Settings › Getting Started › Suggest Other Apps is on (anything but false). */
export const suggestionsOn = (): boolean => workbench.readPreferences().suggestNextApp !== false;

export function useSuggestion({
  id,
  itemId,
  allowed,
  check,
  wake,
}: {
  id: SuggestionId;
  // The open item; null until it is known (then nothing runs).
  itemId: string | null;
  // The role and session gate: an Editor, signed in, a session that may take the action.
  allowed: boolean;
  check: SuggestionCheck;
  // A value whose change asks for a check soon (a call ended, a card done), not waiting for the next tick.
  wake?: unknown;
}): {
  find: SuggestionFind | null;
  take: () => void;
  dismiss: () => void;
  never: () => void;
} {
  const [find, setFind] = useState<SuggestionFind | null>(null);
  // The item it was decided for in this mount; another item starts undecided.
  const [decidedFor, setDecidedFor] = useState<string | null>(null);
  const decided = itemId !== null && decidedFor === itemId;
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!allowed || !itemId || decided) return undefined;
    watchActivity();
    let live = true;
    let running = false;
    const tick = async () => {
      if (!live || running || shownRef.current || showing !== null) return;
      if (document.hidden || noticeSlotHeld() || busyNow() || !suggestionsOn()) return;
      if (!maySuggest(id, itemId)) {
        setDecidedFor(itemId);
        return;
      }
      running = true;
      try {
        const found = await checkRef.current();
        if (!live || !found || showing !== null || busyNow() || noticeSlotHeld()) return;
        showing = id;
        shownRef.current = true;
        setFind(found);
        workbench.track('UI', 'Opened', SUGGESTIONS[id].type);
      } catch {
        // A check that fails suggests nothing; the next tick tries again.
      } finally {
        running = false;
      }
    };
    const every = window.setInterval(() => void tick(), SUGGEST_CHECK_MS);
    const soon = window.setTimeout(() => void tick(), SUGGEST_IDLE_MS);
    return () => {
      live = false;
      window.clearInterval(every);
      window.clearTimeout(soon);
    };
  }, [id, itemId, allowed, decided, wake]);

  // No longer allowed (a role changed, signed out) while on show: it goes, undecided.
  useEffect(() => {
    if (allowed || !shownRef.current) return;
    if (showing === id) showing = null;
    shownRef.current = false;
    setFind(null);
  }, [allowed, id]);

  // Suggest Other Apps turned off while on show ("One switch for all"): it goes at the next tick, undecided, so it
  // can come back if the switch is turned on again. A read of the preferences each tick, only while one shows.
  useEffect(() => {
    if (!find) return undefined;
    const every = window.setInterval(() => {
      if (suggestionsOn()) return;
      if (showing === id) showing = null;
      shownRef.current = false;
      setFind(null);
    }, SUGGEST_CHECK_MS);
    return () => window.clearInterval(every);
  }, [find, id]);

  // Gone with the editor (or the item changed): the page's one place is free again.
  useEffect(
    () => () => {
      if (shownRef.current && showing === id) showing = null;
      shownRef.current = false;
    },
    [id, itemId],
  );

  const close = useCallback(() => {
    if (itemId) decideSuggestion(id, itemId);
    if (showing === id) showing = null;
    shownRef.current = false;
    setFind(null);
    setDecidedFor(itemId);
  }, [id, itemId]);

  const take = useCallback(() => {
    const run = find?.run;
    workbench.track('UI', 'Used', SUGGESTIONS[id].type);
    close();
    void Promise.resolve(run?.()).catch(() => {});
  }, [find, id, close]);

  const dismiss = useCallback(() => {
    workbench.track('UI', 'Closed', SUGGESTIONS[id].type);
    close();
  }, [id, close]);

  const never = useCallback(() => {
    workbench.track('UI', 'Closed', SUGGESTIONS[id].type);
    turnOffSuggestion(id);
    close();
  }, [id, close]);

  return { find: allowed ? find : null, take, dismiss, never };
}

/** Frees the page's one place, for tests. */
export function resetSuggestionShowingForTests(): void {
  showing = null;
}
