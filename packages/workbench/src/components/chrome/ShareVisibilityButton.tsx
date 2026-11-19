'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SHARE_STATE_META, type ShareState, type VisibilityActions } from './share-states';
import { VisibilityLegend } from './VisibilityLegend';
import { VISIBILITY_TONE } from '@liveworkspace/explorer/visibility-tones';

// The corner card's Share button (docs/specs/007-editor/editor-app.md "Header actions", owner 2026-11-19): its words
// wear the item's visibility (Offline grey, Private green, Shared blue, Team violet, Public pink), and on a
// computer hovering it opens the visibility legend the header's badge used to (VisibilityLegend: who can see this,
// on one scale), right-aligned under the button, with Change Who Can See This opening Share. A press opens Share.

/** What decides an item's visibility, as the old header badge read it. */
export type ItemVisibility = { team?: boolean; offline?: boolean; community?: boolean };

export function shareStateOf(shareable: boolean, v: ItemVisibility): ShareState {
  return v.offline
    ? 'offline'
    : v.community
      ? 'community'
      : shareable
        ? 'shared'
        : v.team
          ? 'team'
          : 'private';
}

// Each state's words, its hue from the one table (4.5:1 on the card in both looks).
const INK: Record<ShareState, string> = {
  private: VISIBILITY_TONE.private.ink,
  shared: VISIBILITY_TONE.shared.ink,
  team: VISIBILITY_TONE.team.ink,
  community: VISIBILITY_TONE.public.ink,
  offline: VISIBILITY_TONE.browser.ink,
};

// How long the legend stays after the pointer leaves the button or the legend, so crossing the gap never shuts it.
const LEGEND_CLOSE_GRACE_MS = 120;
// A beat's rest before it opens, so passing over the button on the way elsewhere never flashes it.
const LEGEND_OPEN_DELAY_MS = 150;

export function ShareVisibilityButton({
  state,
  onOpenShare,
  actions,
  className,
  children,
}: {
  state: ShareState;
  onOpenShare: () => void;
  // The legend's stops: each closes the legend and runs the app's own move to that audience.
  actions?: VisibilityActions | undefined;
  // The card's button classes (CORNER_BTN and its hover wash), less the words' colour, which the state sets.
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), LEGEND_CLOSE_GRACE_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom, right: window.innerWidth - r.right });
  }, [open]);
  const meta = SHARE_STATE_META[state];
  return (
    <>
      <button
        ref={ref}
        type="button"
        data-tour-id="share"
        data-share-state={state}
        onClick={() => {
          window.clearTimeout(timer.current);
          setOpen(false);
          onOpenShare();
        }}
        // A mouse only: a touch's hover would open it under the finger that is pressing Share.
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show(LEGEND_OPEN_DELAY_MS);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') hide();
        }}
        aria-label={`Share, ${meta.label}`}
        aria-description={meta.description}
        className={`${className} ${INK[state]}`}
      >
        {children}
      </button>
      {open && at
        ? createPortal(
            <div
              className="fixed z-[var(--z-popover)] max-sm:hidden"
              style={{ top: at.top, right: at.right }}
              onPointerEnter={() => show(0)}
              onPointerLeave={hide}
            >
              <VisibilityLegend
                current={state}
                align="floating"
                actions={
                  actions &&
                  (Object.fromEntries(
                    Object.entries(actions).map(([k, run]) => [
                      k,
                      run &&
                        (() => {
                          setOpen(false);
                          run();
                        }),
                    ]),
                  ) as VisibilityActions)
                }
                onManage={() => {
                  setOpen(false);
                  onOpenShare();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
