'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Portal } from '@liveworkspace/ui';
import { ChartTooltip } from './ChartTooltip';
import { useEmphasis, useEmphasisStore, type EmphasisStore } from './emphasis';
import {
  bucketCentres,
  cycleKey,
  liveSummary,
  nearestIndex,
  placeTooltip,
  stepIndex,
  tooltipRows,
  type HoverMode,
  type HoverSeries,
} from './hover-model';

// The dashboard charts' one hover overlay (liveworkspace/docs/specs/008-telemetry/telemetry.md "Tooltips"). It lies
// over a chart's plot (`absolute inset-0` in the chart's positioned box) and owns everything hovering changes: the
// bucket, the crosshair and dots (or a bar chart's band), the tooltip and the live region. The chart under it never
// re-renders on a pointer move: moves are coalesced to one per animation frame, the bucket is a binary search over
// the buckets' centres, and the overlay renders only when the bucket changes.

type Source = 'pointer' | 'touch' | 'keyboard';
type HoverState = { i: number | null; source: Source | null; pinned: boolean };
const CLOSED: HoverState = { i: null, source: null, pinned: false };

// Keyboard focus shows the latest bucket; a click's focus shows nothing. An engine without :focus-visible counts
// every focus as keyboard.
function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

// Interactive ancestors a chart can sit in (a chart stack's head card opens on a click): there the chart is no tab
// stop of its own, and a click opens the card rather than pinning.
const INTERACTIVE = 'button, a[href], [role="button"]';

export type ChartHoverProps = {
  // Buckets across the plot.
  n: number;
  mode?: HoverMode;
  series: readonly HoverSeries[];
  // The tooltip's heading for bucket `i`: "Tue 10 Nov", "100 to 250 ms".
  heading: (i: number) => string;
  // The chart's accessible name.
  label: string;
  // What a bucket is called in the keyboard hint: "day", "bucket".
  unit?: string;
  format?: (v: number) => string;
  // Each row's change against the bucket before (off for a histogram, whose buckets aren't a sequence in time).
  change?: boolean;
  // Adds the lines up as a Total row under this name, for a chart whose lines add up.
  totalLabel?: string;
  // Shared with the chart's legend, so hovering an entry emphasises its line here.
  emphasis?: EmphasisStore;
};

export function ChartHover({
  n,
  mode = 'points',
  series,
  heading,
  label,
  unit = 'day',
  format,
  change = true,
  totalLabel,
  emphasis,
}: ChartHoverProps) {
  const own = useEmphasisStore();
  const store = emphasis ?? own;
  const emphasised = useEmphasis(store);
  const [state, setState] = useState<HoverState>(CLOSED);
  const [nested, setNested] = useState(false);
  const [scope, setScope] = useState<string | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const xs = useMemo(() => bucketCentres(n, mode), [n, mode]);
  const pending = useRef<{ x: number; source: Source } | null>(null);
  const frame = useRef(0);
  const lastPointer = useRef('mouse');
  // The bucket as of the last render, for the scroll and resize handlers.
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  });

  // Where the chart sits decides two things once: whether it is nested in a clickable card, and which app's accent
  // the portalled tooltip copies (it leaves the page's `data-app` scope for <body>).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    setNested(el.parentElement?.closest(INTERACTIVE) != null);
    setScope(el.closest('[data-app]')?.getAttribute('data-app') ?? undefined);
  }, []);

  const indexAt = useCallback(
    (clientX: number) => {
      const r = root.current?.getBoundingClientRect();
      if (!r || r.width <= 0) return null;
      return nearestIndex(xs, (clientX - r.left) / r.width);
    },
    [xs],
  );

  const flush = useCallback(() => {
    frame.current = 0;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const i = indexAt(p.x);
    setState((s) =>
      s.pinned || (s.i === i && s.source === p.source) ? s : { i, source: p.source, pinned: false },
    );
  }, [indexAt]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    lastPointer.current = e.pointerType;
    pending.current = { x: e.clientX, source: e.pointerType === 'touch' ? 'touch' : 'pointer' };
    if (!frame.current) frame.current = requestAnimationFrame(flush);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== 'touch') return;
    setState({ i: indexAt(e.clientX), source: 'touch', pinned: false });
  };
  // A finger lifting leaves the tooltip up (a tap elsewhere closes it); a mouse leaving closes it unless pinned.
  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    pending.current = null;
    setState((s) => (s.pinned || s.source !== 'pointer' ? s : CLOSED));
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (nested || lastPointer.current === 'touch') return;
    const at = indexAt(e.clientX);
    setState((s) =>
      s.pinned ? { ...s, pinned: false } : { i: s.i ?? at, source: 'pointer', pinned: true },
    );
  };

  const close = useCallback(() => {
    setState(CLOSED);
    store.set(null);
  }, [store]);

  const view = useMemo(() => {
    if (state.i === null) return null;
    return {
      heading: heading(state.i),
      ...tooltipRows(series, state.i, { format, change, totalLabel }),
    };
  }, [state.i, series, heading, format, change, totalLabel]);
  const order = view
    ? [...view.rows.map((r) => r.key), ...(view.total ? [view.total.key] : [])]
    : [];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (state.i === null) return;
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (state.i === null) return;
      e.preventDefault();
      e.stopPropagation();
      store.set(cycleKey(order, store.get(), e.key === 'ArrowDown' ? 1 : -1));
      return;
    }
    const next = stepIndex(e.key, state.i, n);
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    setState({ i: next, source: 'keyboard', pinned: false });
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !focusVisible(e.currentTarget) || n === 0) return;
    setState((s) => (s.i !== null ? s : { i: n - 1, source: 'keyboard', pinned: false }));
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (tip.current?.contains(e.relatedTarget)) return;
    setState((s) => (s.source === 'keyboard' ? CLOSED : s));
  };

  // A pinned or touched tooltip stays until a press elsewhere, or Escape wherever focus is.
  const sticky = state.i !== null && (state.pinned || state.source === 'touch');
  useEffect(() => {
    if (!sticky) return;
    const away = (e: Event) => {
      const t = e.target as Node | null;
      if (root.current?.contains(t) || tip.current?.contains(t)) return;
      close();
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape);
    };
  }, [sticky, close]);

  // Places the tooltip beside the crosshair, by transform only: one read of the plot's box and the tooltip's size,
  // one write. The first placement shows it where it belongs; only later ones glide.
  const place = useCallback(() => {
    const el = root.current;
    const t = tip.current;
    const i = current.current.i;
    if (!el || !t || i === null) return;
    const r = el.getBoundingClientRect();
    const p = placeTooltip({
      plot: r,
      x: r.left + (xs[i] ?? 0) * r.width,
      size: { width: t.offsetWidth, height: t.offsetHeight },
      viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
    });
    t.style.transform = `translate3d(${Math.round(p.left)}px, ${Math.round(p.top)}px, 0)`;
    t.dataset.side = p.side;
    if (t.dataset.placed === undefined) {
      requestAnimationFrame(() => {
        t.dataset.placed = '';
      });
    }
  }, [xs]);
  useLayoutEffect(() => {
    if (view) place();
  }, [view, place]);

  const open = view !== null;
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const again = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          place();
        });
    };
    window.addEventListener('scroll', again, { capture: true, passive: true });
    window.addEventListener('resize', again, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', again, { capture: true });
      window.removeEventListener('resize', again);
    };
  }, [open, place]);

  const hint =
    state.source === 'pointer' && !nested
      ? state.pinned
        ? 'Pinned, Click or Esc to Let Go'
        : 'Click to Pin'
      : undefined;

  return (
    <div
      ref={root}
      tabIndex={nested ? undefined : 0}
      role="group"
      aria-roledescription="chart"
      aria-label={`${label}. Left and Right arrows read each ${unit}.`}
      data-chart-hover=""
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`absolute inset-0 touch-pan-y select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-900 ${
        nested ? '' : 'cursor-pointer'
      }`}
    >
      {state.i !== null ? (
        <Markers
          i={state.i}
          n={n}
          x={xs[state.i] ?? 0}
          mode={mode}
          series={series}
          emphasised={emphasised}
        />
      ) : null}
      <p className="sr-only" aria-live="polite">
        {state.source === 'keyboard' && view
          ? liveSummary(view.heading, view.rows, view.total)
          : ''}
      </p>
      {view ? (
        <Portal>
          <div
            ref={tip}
            data-app={scope}
            data-chart-tooltip=""
            className={`fixed left-0 top-0 z-[var(--z-toast)] opacity-0 data-[placed]:opacity-100 data-[placed]:transition-[transform,opacity] data-[placed]:duration-100 data-[placed]:ease-out motion-reduce:transition-none ${
              state.pinned ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <ChartTooltip
              heading={view.heading}
              rows={view.rows}
              total={view.total}
              change={change}
              emphasised={emphasised}
              onEmphasis={store.set}
              hint={hint}
            />
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

// What marks the hovered bucket. A line chart: a hairline crosshair and a ringed dot on every line at its value, the
// emphasised line's larger. A bar chart: the hovered column's band tinted, the others veiled. All of it moves by
// transform, inside a clip a little larger than the plot (so an edge dot shows whole and nothing widens the page).
function Markers({
  i,
  n,
  x,
  mode,
  series,
  emphasised,
}: {
  i: number;
  n: number;
  x: number;
  mode: HoverMode;
  series: readonly HoverSeries[];
  emphasised: string | null;
}) {
  const glide = 'transition-transform duration-100 ease-out motion-reduce:transition-none';
  if (mode === 'bands') {
    const veil = `absolute inset-0 bg-white/50 dark:bg-slate-900/50 ${glide}`;
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={veil} style={{ transform: `translateX(calc(${(i / n) * 100}% - 100%))` }} />
        <div className={veil} style={{ transform: `translateX(${((i + 1) / n) * 100}%)` }} />
        <div
          data-band={i}
          className={`absolute inset-y-0 left-0 rounded-sm bg-slate-500/10 dark:bg-slate-300/15 ${glide}`}
          style={{ width: `${100 / n}%`, transform: `translateX(${i * 100}%)` }}
        />
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-2 overflow-hidden">
      <div
        data-crosshair={i}
        className={`absolute inset-2 ${glide}`}
        style={{ transform: `translateX(${x * 100}%)` }}
      >
        <div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-slate-400/70 dark:bg-slate-500/70" />
        {series.map((s) => {
          const y = s.y?.[i];
          if (y === null || y === undefined) return null;
          return (
            <div
              key={s.key}
              data-marker={s.key}
              className={`absolute inset-0 ${glide}`}
              style={{ transform: `translateY(${y}%)` }}
            >
              <span
                data-app={s.app}
                className={`absolute left-0 top-0 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-[scale] duration-100 motion-reduce:transition-none dark:ring-slate-900 ${
                  emphasised === s.key ? 'scale-150' : ''
                } ${s.className ?? ''}`}
                style={{ backgroundColor: s.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
