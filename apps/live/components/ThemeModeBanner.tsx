'use client';

// A floating bottom-centre prompt offering to match the editor's UI mode
// (light / dark chrome, useUiMode / spec/07) to the ACTIVE TAB'S THEME:
// viewing a dark-backdrop theme in light mode offers dark, and a
// light-backdrop theme in dark mode offers light. Only appears on a
// mismatch; dismissible. The "is this theme dark?" test reads the
// resolved theme's backdrop luminance, so it works for built-in AND
// custom themes (spec/44) without a category lookup.
//
// Visual mirrors the sign-in prompt (SignInBanner): a floating rounded
// card lifted above the tab bar. Self-contained — it reads the UI mode
// itself and re-offers when the tab's theme changes (the dismissal is
// keyed to the specific mismatch, not forever).

import { useState } from 'react';
import { isLightColor } from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { useUiMode } from '@/hooks/useUiMode';

export function ThemeModeBanner({ themeId }: { themeId: string | undefined }) {
  const { mode, toggle } = useUiMode();
  // The mismatch this banner was dismissed for. Keyed by theme + target
  // so dismissing it for one tab doesn't suppress it forever: switch to a
  // differently-themed tab (a new mismatch) and it offers again.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const target: 'light' | 'dark' = isLightColor(getTheme(themeId).backgroundColor)
    ? 'light'
    : 'dark';
  const key = `${themeId ?? ''}:${target}`;
  if (mode === target || dismissedKey === key) return null;

  const toDark = target === 'dark';
  const title = toDark ? 'This tab uses a dark theme' : 'This tab uses a light theme';
  const sub = toDark
    ? 'Switch the editor to dark mode to match.'
    : 'Switch the editor to light mode to match.';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-16">
      <div className="pointer-events-auto flex w-full max-w-md animate-fly-up-in items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{sub}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={toDark ? 'Switch to dark mode' : 'Switch to light mode'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm transition hover:bg-brand-600"
        >
          {toDark ? <MoonIcon /> : <SunIcon />}
        </button>
        <button
          type="button"
          onClick={() => setDismissedKey(key)}
          aria-label="Dismiss"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
    </svg>
  );
}
