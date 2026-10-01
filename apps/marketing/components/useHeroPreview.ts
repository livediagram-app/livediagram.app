'use client';

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';
import { HERO_IDLE, heroStageReducer, type HeroEnv } from '@/lib/hero-preview-stage';
import { isPlainClick } from './hero-launch';

// Drives the hero's stage (docs/specs/019-marketing/hero-environment-preview.md): the intent delay
// into a first preview, the grace delay out of one, and the launch that opens the link once the
// environment's chrome has landed.

/** A pointer must rest this long on a button before the first preview. */
export const HERO_PREVIEW_INTENT_MS = 120;
/** Leaving the buttons returns to idle after this, so crossing a gap keeps the preview. */
export const HERO_PREVIEW_GRACE_MS = 200;
/** A launch opens its link once hero-preview.css's chrome cascade has settled. */
export const HERO_LAUNCH_MS = 600;

// Only where there is hover and room behind the buttons (spec, "Touch and small screens").
export const HERO_PREVIEW_QUERY = '(hover: hover) and (min-width: 640px)';

export function useHeroPreview() {
  const [stage, dispatch] = useReducer(heroStageReducer, HERO_IDLE);
  // The environments render (hidden) from the first time a pointer or focus enters the buttons.
  const [warm, setWarm] = useState(false);
  const enabled = useMediaQuery(HERO_PREVIEW_QUERY);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const after = (ms: number, run: () => void) => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      run();
    }, ms);
  };

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      dispatch({ type: 'reset' });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const preview = (env: HeroEnv) => {
    if (!enabled || stage.kind === 'launching') return;
    setWarm(true);
    if (stage.kind === 'previewing') {
      cancel();
      dispatch({ type: 'preview', env });
    } else {
      after(HERO_PREVIEW_INTENT_MS, () => dispatch({ type: 'preview', env }));
    }
  };
  const leave = () => {
    if (stage.kind === 'launching') return;
    after(HERO_PREVIEW_GRACE_MS, () => dispatch({ type: 'leave' }));
  };

  const groupProps = {
    onPointerEnter: () => enabled && setWarm(true),
    onPointerLeave: leave,
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Escape' || stage.kind !== 'previewing') return;
      cancel();
      dispatch({ type: 'leave' });
    },
  };

  const ctaProps = (env: HeroEnv, href: string) => ({
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') preview(env);
    },
    onFocus: () => preview(env),
    onClick: (e: MouseEvent<HTMLElement>) => {
      // A tap, a modified click, no room for a preview, or reduced motion: the link, untouched.
      if (!enabled || reduceMotion || !isPlainClick(e) || stage.kind === 'launching') return;
      e.preventDefault();
      dispatch({ type: 'launch', env });
      after(HERO_LAUNCH_MS, () => window.location.assign(href));
    },
  });

  return { stage, warm, groupProps, ctaProps };
}
