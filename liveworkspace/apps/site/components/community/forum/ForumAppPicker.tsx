'use client';

import { useRef, type KeyboardEvent } from 'react';
import { COMMUNITY_APPS, forumAppLabel, type ForumApp } from '@liveworkspace/community';
import { ForumAppLogo } from './ForumAppLogo';

// Which app a new post is about (liveworkspace/docs/specs/007-community/community.md "Categories and apps"): every app
// as a tile with its logo, then Any App. One radio group: arrows move and choose, as a radio group's do.

const CHOICES: readonly ForumApp[] = [...COMMUNITY_APPS, null];

export function ForumAppPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: ForumApp;
  onChange: (app: ForumApp) => void;
  labelledBy: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const move = (e: KeyboardEvent, from: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (from + step + CHOICES.length) % CHOICES.length;
    onChange(CHOICES[next]!);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {CHOICES.map((app, i) => {
        const checked = app === value;
        return (
          <button
            key={app ?? 'any'}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={forumAppLabel(app)}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(app)}
            onKeyDown={(e) => move(e, i)}
            className={`flex h-10 cursor-pointer items-center justify-center rounded-lg px-2 transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              checked
                ? 'bg-brand-50 ring-2 ring-inset ring-brand-600 dark:bg-brand-500/15 dark:ring-brand-400'
                : 'bg-white ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <ForumAppLogo app={app} />
          </button>
        );
      })}
    </div>
  );
}
