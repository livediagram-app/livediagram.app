// The mind-map keystroke handoff (docs/specs/009-elements/mind-node.md "Typing ahead").
//
// Someone who knows the keys types "Tab, Marketing, Enter, Sales" as one
// burst, faster than the editor re-renders. Between a growth and the new
// node's label editor taking focus, every one of those keys belongs to a node
// that is not on screen yet. Left alone they went to the editor being left, to
// the canvas as shortcuts, or nowhere: labels came out blank, and a Tab in the
// gap grew from the wrong node.
//
// So a growth opens a handoff for the new node. Until that node's editor
// claims it, a capture-phase listener on `window` takes every plain key into a
// queue of SEGMENTS: the text typed for one node, ended by the key that left
// it (Tab, Enter, Escape).
//
// When the editor mounts and claims:
//  - a segment still being typed is handed to the editor, which types it in;
//  - a segment already ENDED never needs the editor at all. The editor closes
//    without committing, and on the next task the handoff asks the editor
//    state to finish the node itself: write the label and grow the next node
//    (Tab / Enter) in one commit, or keep / drop it (Escape). Going round the
//    editor matters: a replay from inside it raced its own mount (the label
//    commit read a snapshot from before the node existed, and a remount closed
//    the editor before the replay ran), and dropped the rest of the burst.
//  - Between that claim and the growth it triggers, the listener stays on
//    (CARRYING), so anything typed meanwhile reaches the node after it.
//
// Module state rather than React state: there is one keyboard and one label
// editor, and the capture has to be in place synchronously, before the very
// next keydown, which no render cycle guarantees.

import { debugLog } from '@/lib/debug-log';

/** How a segment of typed text was left. */
export type HandoffEnd = 'child' | 'sibling' | 'escape';

export type HandoffSegment = { text: string; end?: HandoffEnd };

/** What the editor state does for a node whose typing ended before its
 *  editor ever opened. Called with the LATEST state, on a later task. */
export type HandoffActions = {
  /** Write `text` as the node's label. */
  settle: (id: string, text: string) => void;
  /** Write `label` and grow the next node from this one, in one commit. */
  grow: (id: string, kind: 'child' | 'sibling', label: string) => void;
  /** The node was left empty with Escape: the Tab one time too many. */
  abandon: (id: string) => void;
};

type Pending = {
  // Null while CARRYING: the keys are for a node that does not exist yet.
  id: string | null;
  segments: HandoffSegment[];
  actions: HandoffActions;
  detach: () => void;
};

/** Long enough for any real render; short enough that a node a peer deleted
 *  mid-burst does not swallow the keyboard noticeably. */
export const MIND_HANDOFF_TIMEOUT_MS = 1500;

let pending: Pending | null = null;

/**
 * What one keydown does to the queue. Exported for the tests; the listener is
 * a thin wrapper around it. Returns false for a key the handoff lets through.
 */
export function applyHandoffKey(
  segments: HandoffSegment[],
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey' | 'isComposing'>,
): boolean {
  // Undo, copy, an IME composition: not typing, so not ours.
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false;
  const open = segments[segments.length - 1]!;
  if (open.end === 'escape') return false;
  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
    open.end = e.key === 'Tab' ? 'child' : 'sibling';
    segments.push({ text: '' });
    return true;
  }
  if (e.key === 'Enter') {
    // Shift+Enter is a newline in a node's label.
    open.text += '\n';
    return true;
  }
  if (e.key === 'Escape') {
    open.end = 'escape';
    return true;
  }
  if (e.key === 'Backspace') {
    open.text = open.text.slice(0, -1);
    return true;
  }
  if (e.key.length === 1) {
    open.text += e.key;
    return true;
  }
  // Arrows, Delete, Home ...: swallowed, because on the canvas they would
  // nudge or delete the node that is on its way.
  return true;
}

function release(p: Pending) {
  p.detach();
  if (pending === p) pending = null;
}

// What was typed for a node that never claimed it, written onto its label.
function settleUnclaimed(p: Pending) {
  const text = p.segments[0]?.text ?? '';
  if (p.id && text) p.actions.settle(p.id, text);
}

/**
 * Start capturing keys for node `id`, which has just been grown and whose
 * editor is on its way.
 */
export function beginMindHandoff(id: string, actions: HandoffActions): void {
  if (typeof window === 'undefined') return;
  let segments: HandoffSegment[] = [{ text: '' }];
  if (pending) {
    const prev = pending;
    release(prev);
    // Carrying: this growth is the one the queue was waiting for, so it
    // inherits everything typed since.
    if (prev.id === null) segments = prev.segments.length > 0 ? prev.segments : segments;
    // A growth that never reached its editor (two "+" clicks in a row): keep
    // what was typed for it rather than dropping it.
    else settleUnclaimed(prev);
  }
  const p: Pending = { id, segments, actions, detach: () => {} };
  const onKey = (e: KeyboardEvent) => {
    if (pending !== p || !applyHandoffKey(p.segments, e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const timer = window.setTimeout(() => {
    if (pending !== p) return;
    release(p);
    debugLog(
      `[mind-handoff] unclaimed id=${p.id ?? 'carrying'} timeout=${MIND_HANDOFF_TIMEOUT_MS}`,
    );
    settleUnclaimed(p);
  }, MIND_HANDOFF_TIMEOUT_MS);
  window.addEventListener('keydown', onKey, true);
  p.detach = () => {
    window.removeEventListener('keydown', onKey, true);
    window.clearTimeout(timer);
  };
  pending = p;
  debugLog(
    `[mind-handoff] begin id=${id} carried=${segments.length > 1 || segments[0]!.text !== ''}`,
  );
}

/**
 * Called by a mind node's label editor as it mounts.
 *
 * - `null`: no handoff was waiting for this node; edit as normal.
 * - `{ type: 'text' }`: this node is still being typed; the editor types
 *   `text` in and carries on.
 * - `{ type: 'finished' }`: typing for this node already ended; the editor
 *   closes WITHOUT committing, and the handoff finishes the node itself.
 */
export function claimMindHandoff(
  id: string,
): null | { type: 'text'; text: string } | { type: 'finished' } {
  if (!pending || pending.id !== id) return null;
  const p = pending;
  const [first, ...rest] = p.segments;
  const text = first?.text ?? '';
  const end = first?.end;
  debugLog(
    `[mind-handoff] claim id=${id} chars=${text.length} end=${end ?? 'none'} queued=${rest.length}`,
  );
  if (end === 'child' || end === 'sibling') {
    p.id = null;
    p.segments = rest.length > 0 ? rest : [{ text: '' }];
    // A task later, once this editor has closed and every effect of the
    // commit that mounted it has run.
    window.setTimeout(() => p.actions.grow(id, end, text), 0);
    return { type: 'finished' };
  }
  release(p);
  if (end === 'escape') {
    window.setTimeout(
      () => (text.trim() === '' ? p.actions.abandon(id) : p.actions.settle(id, text)),
      0,
    );
    return { type: 'finished' };
  }
  return { type: 'text', text };
}

/** Test seam: forget everything. */
export function resetMindHandoff(): void {
  if (pending) release(pending);
}
