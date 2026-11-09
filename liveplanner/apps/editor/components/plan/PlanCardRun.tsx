'use client';

// One run of a busy board's cell (card-runs.ts; docs/specs/026-plan/plan-board.md "Cards out of view wait", blueprint
// plan-board.md "Far runs"): its cards built only while it is near the view (hooks/plan/useCardRunReveal.ts), else an
// empty placeholder holding its height. Without a reveal (no IntersectionObserver) the run is always near.
import { use, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RUN_FAR, RUN_NEAR, RunRevealContext, type RunState } from '@/hooks/plan/useCardRunReveal';

export function PlanCardRun({
  ids,
  count,
  simplified,
  children,
}: {
  // The run's card ids, space separated.
  ids: string;
  count: number;
  simplified: boolean;
  // The run's cards, built only while it is near.
  children: ReactNode;
}) {
  const reveal = use(RunRevealContext);
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RunState>(() => (reveal ? RUN_FAR : RUN_NEAR));
  // A card asked for focus while the run was far: focused once it is built.
  const pending = useRef<{ id: string; opts: FocusOptions | undefined } | null>(null);
  useLayoutEffect(() => {
    const run = ref.current;
    if (!run || !reveal) return;
    return reveal.attach(run, {
      set: setState,
      focusAfter: (id, opts) => {
        pending.current = { id, opts };
        setState(RUN_NEAR);
      },
    });
  }, [reveal]);
  const near = state.near;
  useLayoutEffect(() => {
    const run = ref.current;
    if (!run || !near) return;
    reveal?.drawn(run);
  }, [near, reveal]);
  useLayoutEffect(() => {
    const want = pending.current;
    if (!want || !near) return;
    pending.current = null;
    ref.current
      ?.querySelector<HTMLElement>(`[data-plan-card="${CSS.escape(want.id)}"]`)
      ?.focus(want.opts);
  });
  const h = state.near ? undefined : state.h;
  return (
    <div
      ref={ref}
      data-plan-run=""
      // RUN_IDS_ATTR and RUN_NEAR_ATTR.
      data-plan-run-ids={ids}
      data-plan-run-near={near ? '' : undefined}
      className={`plan-card-run flex flex-col ${simplified ? 'gap-1.5' : 'gap-2'}`}
      style={{
        ['--run-cards' as string]: count,
        ...(h !== undefined ? { ['--run-h' as string]: `${h}px` } : {}),
      }}
    >
      {near ? children : null}
    </div>
  );
}
