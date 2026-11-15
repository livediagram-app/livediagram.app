'use client';

// Prototype mode (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): a wireframe tab played one screen at a
// time inside its device frame, over the whole window. A press on a hotspot follows its link with its transition; a
// press anywhere else flashes the hotspots; Previous, Next and the arrow keys step through the screens; Escape or
// Close returns to the editor. Nothing here edits: it draws the live tab and writes nothing.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { layOutPages, pagesOf, screenName, type Tab } from '@livedesign/design';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  followHotspot,
  prototypeHotspots,
  PROTOTYPE_FLASH_MS,
  PROTOTYPE_TRANSITION_MS,
  shownScreen,
  startPlayer,
  stepScreen,
  type Hotspot,
  type PlayerState,
  type ScreenChange,
} from '@/lib/prototype-player';
import { PrototypeBar } from './PrototypeBar';
import { PrototypeScreen } from './PrototypeScreen';

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** Whether motion is allowed: neither the system's reduced motion nor Settings' Reduce Motion is on. */
export function prefersReducedMotion(): boolean {
  if (document.documentElement.classList.contains('reduce-motion')) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The two layers' keyframes for a change: the screen coming in, and the one it covers.
function changeFrames(change: ScreenChange): { incoming: Keyframe[]; leaving: Keyframe[] } {
  if (change.transition === 'dissolve') {
    return {
      incoming: [{ opacity: 0 }, { opacity: 1 }],
      leaving: [{ opacity: 1 }, { opacity: 1 }],
    };
  }
  const sign = change.direction === 'back' ? -1 : 1;
  return {
    incoming: [{ transform: `translateX(${sign * 100}%)` }, { transform: 'translateX(0)' }],
    leaving: [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: `translateX(${-sign * 33}%)`, opacity: 0.6 },
    ],
  };
}

export function PrototypePlayer({
  tab,
  startId,
  onClose,
  copyLink,
}: {
  tab: Tab;
  startId: string | null;
  // Called with the screen last shown, which the editor frames.
  onClose: (shownId: string) => void;
  // Copy Prototype Link; null where there is no link to copy.
  copyLink: (() => void) | null;
}) {
  const pages = layOutPages(pagesOf(tab));
  const [state, setState] = useState<PlayerState>(() => startPlayer(pages, startId));
  const shown = shownScreen(state, pages);
  const index = shown ? pages.indexOf(shown) : -1;
  const hotspots = shown ? prototypeHotspots(tab, shown, pages) : [];
  const phone = useIsMobileViewport();

  // The hotspots' flash: lit on a press off them, for a moment.
  const [lit, setLit] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  const flash = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setLit(true);
    flashTimer.current = setTimeout(() => setLit(false), PROTOTYPE_FLASH_MS);
  };

  // A change that moves keeps the screen it leaves beneath until its motion settles.
  const change = state.change;
  const [settled, setSettled] = useState(0);
  const moving =
    change !== null &&
    change.transition !== 'instant' &&
    change.seq !== settled &&
    change.fromId !== shown?.id;
  const [motionOff] = useState(prefersReducedMotion);
  const animates = moving && !motionOff;
  const leavingPage = animates ? pages.find((p) => p.id === change.fromId) : undefined;
  const incomingRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!change || !moving) return;
    const seq = change.seq;
    const incoming = incomingRef.current;
    const leaving = leavingRef.current;
    if (motionOff || !incoming?.animate || !leaving) {
      setSettled(seq);
      return;
    }
    const frames = changeFrames(change);
    const timing = { duration: PROTOTYPE_TRANSITION_MS, easing: EASE };
    const a = incoming.animate(frames.incoming, timing);
    const b = leaving.animate(frames.leaving, timing);
    a.onfinish = () => setSettled(seq);
    return () => {
      a.cancel();
      b.cancel();
    };
  }, [change, moving, motionOff]);

  const follow = (h: Hotspot) => setState((s) => followHotspot(s, h.link, pages));
  const step = (by: 1 | -1) => setState((s) => stepScreen(s, pages, by));
  const close = () => onClose(shown?.id ?? state.shownId);

  // Keys: the player's own, and the editor's shortcuts held off while it is open.
  const latest = useLatest({ close, step, follow, hotspots });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      const now = latest.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        now.close();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        now.step(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const id = (e.target as Element | null)?.getAttribute?.('data-hotspot-id');
        const h = id ? now.hotspots.find((x) => x.elementId === id) : undefined;
        if (h) {
          e.preventDefault();
          now.follow(h);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        // With the editor's select-all held off, the browser's would select the page's text behind the player.
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [latest]);

  // Focus moves into the player as it opens and back to what had it as it closes.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  if (!shown) return null;
  const place = `${index + 1} of ${pages.length}`;
  const layer = phone ? 'absolute inset-0' : 'absolute inset-0 p-6 sm:p-10';
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Prototype"
      tabIndex={-1}
      data-prototype-player=""
      className={`fixed inset-0 z-[var(--z-modal)] flex flex-col outline-none ${phone ? 'bg-black' : 'bg-slate-100 dark:bg-slate-950'}`}
    >
      <PrototypeBar
        phone={phone}
        name={screenName(shown, index)}
        place={place}
        atStart={index <= 0}
        atEnd={index >= pages.length - 1}
        onStep={step}
        onClose={close}
        copyLink={copyLink}
      />
      <div
        data-prototype-stage=""
        className="relative min-h-0 flex-1 overflow-hidden"
        onPointerDown={(e) => {
          if (!(e.target as Element).closest?.('[data-hotspot-id]')) flash();
        }}
      >
        {leavingPage ? (
          <div ref={leavingRef} className={layer} aria-hidden>
            <PrototypeScreen
              tab={tab}
              page={leavingPage}
              pages={pages}
              index={pages.indexOf(leavingPage)}
              hotspots={null}
              lit={false}
              screenOnly={phone}
              onFollow={() => {}}
            />
          </div>
        ) : null}
        <div ref={incomingRef} key={shown.id} className={layer}>
          <PrototypeScreen
            tab={tab}
            page={shown}
            pages={pages}
            index={index}
            hotspots={hotspots}
            lit={lit}
            screenOnly={phone}
            onFollow={follow}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
