'use client';

// A busy board's far runs wait (docs/specs/026-plan/plan-board.md "Cards out of view wait"; blueprint plan-board.md
// "Far runs"). Safari styles a `content-visibility` subtree all the same, so a run's cards are drawn only while the
// run carries RUN_NEAR_ATTR (app/globals.css `plan-card-run`): a far run's cards are `display: none` and the run keeps
// its last drawn height (`--run-h`) or the estimate for its cards. React writes neither, so a re-render keeps both.
import { useLayoutEffect, type RefObject } from 'react';

export const RUN_NEAR_ATTR = 'data-plan-run-near';
const RUN = '[data-plan-run]';
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

export function markNear(run: HTMLElement): void {
  if (run.hasAttribute(RUN_NEAR_ATTR)) return;
  run.style.removeProperty('--run-h');
  run.setAttribute(RUN_NEAR_ATTR, '');
}

// Far: its height (read before any run was marked) kept first, so the board below it stays put.
function markFar(run: HTMLElement, height: number): void {
  if (!run.hasAttribute(RUN_NEAR_ATTR)) return;
  run.style.setProperty('--run-h', `${height}px`);
  run.removeAttribute(RUN_NEAR_ATTR);
}

// A card about to take focus: its run drawn first, as a `display: none` card takes none.
export function revealCard(card: Element | null | undefined): void {
  const run = card?.closest<HTMLElement>(RUN);
  if (run) markNear(run);
}

// Every box read before any run is marked: a mark between two reads would lay the board out again for the next.
function markNearOf(runs: Iterable<HTMLElement>, body: HTMLElement): void {
  const view = body.getBoundingClientRect();
  const near: HTMLElement[] = [];
  for (const run of runs) if (runIsNear(run.getBoundingClientRect(), view)) near.push(run);
  for (const run of near) markNear(run);
}

function runsIn(nodes: Iterable<Node>): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const n of nodes) {
    if (!(n instanceof HTMLElement)) continue;
    if (n.matches(RUN)) out.push(n);
    else for (const run of n.querySelectorAll<HTMLElement>(RUN)) out.push(run);
  }
  return out;
}

export function useCardRunReveal(body: RefObject<HTMLElement | null>, busy: boolean): void {
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || !busy) return;
    const runs = el.querySelectorAll<HTMLElement>(RUN);
    if (typeof IntersectionObserver !== 'function') {
      // No way to learn when a run comes near: every run is drawn.
      for (const run of runs) markNear(run);
      const all = new MutationObserver((records) => {
        for (const r of records) for (const run of runsIn(r.addedNodes)) markNear(run);
      });
      all.observe(el, { childList: true, subtree: true });
      return () => all.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        // The heights of the runs going far are read first, then everything is marked: one layout, not one a run.
        const far = entries
          .filter((e) => !e.isIntersecting && e.target.hasAttribute(RUN_NEAR_ATTR))
          .map((e) => e.target as HTMLElement);
        const heights = far.map((run) => run.offsetHeight);
        far.forEach((run, i) => markFar(run, heights[i]!));
        for (const e of entries) if (e.isIntersecting) markNear(e.target as HTMLElement);
      },
      { root: el, rootMargin: `${RUN_NEAR_VIEWS * 100}%` },
    );
    for (const run of runs) io.observe(run);
    markNearOf(runs, el);
    // Runs React adds (a filter, a column expanding, a card moving): observed, and the near ones drawn now, in the
    // microtask after the commit, before the frame is drawn, so a run arriving in view never shows empty.
    // A run React takes out is let go, so the observer never holds a run no board draws.
    const mo = new MutationObserver((records) => {
      const added = new Set<HTMLElement>();
      for (const r of records) {
        for (const run of runsIn(r.removedNodes)) {
          io.unobserve(run);
          added.delete(run);
        }
        for (const run of runsIn(r.addedNodes)) {
          io.observe(run);
          added.add(run);
        }
      }
      if (added.size) markNearOf(added, el);
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [body, busy]);
}
