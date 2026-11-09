'use client';

// A busy board's far runs wait (docs/specs/026-plan/plan-board.md "Cards out of view wait"; blueprint plan-board.md
// "Far runs"). A run's cards are built only while the run is near (components/plan/PlanCardRun.tsx): a far run is an
// empty placeholder that keeps its last drawn height (`--run-h`) or the estimate for its cards (app/globals.css
// `plan-card-run`). Opening a 2,000-card board built every card's DOM, then hid the far ones; Safari also styled them.
import { createContext, useLayoutEffect, useMemo } from 'react';

export const RUN_NEAR_ATTR = 'data-plan-run-near';
// A run's card ids, space separated, so a far card (not built) can be found by its run.
export const RUN_IDS_ATTR = 'data-plan-run-ids';
// How far past the body's visible box a run counts as near, in body boxes on every side.
export const RUN_NEAR_VIEWS = 1;

type Box = { top: number; bottom: number; left: number; right: number };

// A run within RUN_NEAR_VIEWS of the view on every side.
export function runIsNear(run: Box, view: Box): boolean {
  const my = (view.bottom - view.top) * RUN_NEAR_VIEWS;
  const mx = (view.right - view.left) * RUN_NEAR_VIEWS;
  return !(
    run.bottom < view.top - my ||
    run.top > view.bottom + my ||
    run.right < view.left - mx ||
    run.left > view.right + mx
  );
}

// A run's state: near (its cards built), else far, with the height it had as it went far.
export type RunState = { near: true } | { near: false; h?: number };
export const RUN_NEAR: RunState = { near: true };
export const RUN_FAR: RunState = { near: false };

// What a run hands the board as it mounts: how to set its state, and to focus one of its cards once they are built.
export type RunHandle = {
  set: (s: RunState) => void;
  focusAfter: (id: string, opts: FocusOptions | undefined) => void;
};

// Every mounted run's handle, by its element: a card about to take focus (focusPlanCard) or a run the card flip reads
// (cardsToMeasure) is drawn through it.
const handles = new WeakMap<Element, RunHandle>();

// A run drawn near now (the flip reads it in a commit; its cards are built in the render that follows).
export function markNear(run: Element): void {
  handles.get(run)?.set(RUN_NEAR);
}

const quoted = (id: string) => `"${CSS.escape(id)}"`;

const cardSelector = (id: string) => `[data-plan-card=${quoted(id)}]`;
const farRunSelector = (id: string) => `[${RUN_IDS_ATTR}~=${quoted(id)}]:not([${RUN_NEAR_ATTR}])`;

// A card's element, or, while its run is far, the run holding it: a far card has no element of its own.
export function cardOrRunSelector(id: string): string {
  return `${cardSelector(id)}, ${farRunSelector(id)}`;
}

// Focus a card by id: at once when it is built, else its run is drawn and the card focused once it is.
export function focusPlanCard(
  root: ParentNode | null | undefined,
  id: string | null | undefined,
  opts?: FocusOptions,
): void {
  if (!root || !id) return;
  const card = root.querySelector<HTMLElement>(cardSelector(id));
  if (card) card.focus(opts);
  else {
    const run = root.querySelector(farRunSelector(id));
    if (run) handles.get(run)?.focusAfter(id, opts);
  }
}

// The board's side of its runs: one IntersectionObserver over them, made with the first run that mounts.
export type RunReveal = {
  // A run mounting: its handle kept, the run observed, and drawn at once when it is near. Returns its release.
  attach: (run: HTMLElement, handle: RunHandle) => () => void;
  // A run's cards just built: the board's card flip learns where they are (what `listen` was handed).
  drawn: (run: HTMLElement) => void;
  listen: (onDrawn: ((run: HTMLElement) => void) | undefined) => void;
  dispose: () => void;
};

export const RunRevealContext = createContext<RunReveal | null>(null);

// The board's scroll body, a run's observer root: found from the run, as React sets the body's ref only after its
// runs' layout effects.
export const RUN_BODY_ATTR = 'data-plan-body';

function createRunReveal(): RunReveal {
  let io: IntersectionObserver | null = null;
  let heard: ((run: HTMLElement) => void) | undefined;
  // The runs drawn near, so the observer sets a run only when its state changes.
  const near = new WeakSet<Element>();
  const set = (run: Element, s: RunState) => handles.get(run)?.set(s);
  const observer = (root: HTMLElement) =>
    new IntersectionObserver(
      (entries) => {
        // The heights of the runs going far are read first, then every run is set: one layout, not one a run.
        const far = entries
          .filter((e) => !e.isIntersecting && near.has(e.target))
          .map((e) => e.target as HTMLElement);
        const heights = far.map((run) => run.offsetHeight);
        far.forEach((run, i) => set(run, { near: false, h: heights[i]! }));
        for (const e of entries)
          if (e.isIntersecting && !near.has(e.target)) set(e.target, RUN_NEAR);
      },
      { root, rootMargin: `${RUN_NEAR_VIEWS * 100}%` },
    );
  return {
    attach(run, own) {
      // Every way a run is set (the observer, markNear, focusPlanCard) goes through here, so `near` stays true.
      const handle: RunHandle = {
        set: (s) => {
          if (s.near) near.add(run);
          else near.delete(run);
          own.set(s);
        },
        focusAfter: (id, opts) => {
          near.add(run);
          own.focusAfter(id, opts);
        },
      };
      handles.set(run, handle);
      const root = run.closest<HTMLElement>(`[${RUN_BODY_ATTR}]`);
      if (root) {
        io ??= observer(root);
        io.observe(run);
        // Read in the runs' layout effects, before any is drawn: one layout for them all, and the near ones are
        // built before the frame is drawn, so a run arriving in view never shows empty.
        if (runIsNear(run.getBoundingClientRect(), root.getBoundingClientRect()))
          set(run, RUN_NEAR);
      } else set(run, RUN_NEAR);
      return () => {
        io?.unobserve(run);
        near.delete(run);
        if (handles.get(run) === handle) handles.delete(run);
      };
    },
    drawn: (run) => heard?.(run),
    listen: (onDrawn) => {
      heard = onDrawn;
    },
    dispose() {
      io?.disconnect();
      io = null;
    },
  };
}

// The board's run reveal, while busy and the browser can say when a run comes near; null otherwise, when every run
// is drawn (jsdom, an old browser). Its runs sit inside an element carrying RUN_BODY_ATTR (the board's scroll body).
// `onDrawn` hears each run whose cards were just built (usePlanCardFlip).
export function useCardRunReveal(
  busy: boolean,
  onDrawn?: (run: HTMLElement) => void,
): RunReveal | null {
  const reveal = useMemo(
    () => (busy && typeof IntersectionObserver === 'function' ? createRunReveal() : null),
    [busy],
  );
  useLayoutEffect(() => reveal?.listen(onDrawn));
  useLayoutEffect(() => () => reveal?.dispose(), [reveal]);
  return reveal;
}
