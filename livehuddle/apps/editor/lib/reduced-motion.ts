'use client';

// Reduced motion as it changes, not only as a component mounted: the OS setting's media query, and the in-app
// preference's `.reduce-motion` class on <html>. Shared by the canvas's live characters (the office dog, the Receptionist), so
// turning either on stills them at once.
import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

export function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  query?.addEventListener?.('change', onChange);
  const html = new MutationObserver(onChange);
  html.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => {
    query?.removeEventListener?.('change', onChange);
    html.disconnect();
  };
}

/** Whether motion is reduced right now, re-read whenever either setting changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
}
