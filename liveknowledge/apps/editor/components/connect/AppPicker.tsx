'use client';

// Pick Your AI App (docs/specs/030-knowledgebase/mcp-connect.md "The view" 1): six cards, one picked, as a radio
// group: one stop for Tab, the arrows, Home and End moving the pick. Each a generic glyph for its kind of app, never
// a company's logo.
import { useId, useRef, type KeyboardEvent } from 'react';
import type { AiClientGroup } from '@liveworkspace/marketing-site/lib/ai-clients';
import {
  lucideAppWindow,
  lucideCheck,
  lucideLink,
  lucideMessagesSquare,
  lucideSquareCode,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';
import type { ConnectApp, ConnectAppId } from '@/lib/knowledge-connect/connect-apps';

const GROUP_ICON: Record<AiClientGroup, ReturnType<typeof lucideGlyph>> = {
  'Chat apps': lucideGlyph(lucideMessagesSquare, 18),
  'Coding agents': lucideGlyph(lucideSquareCode, 18),
  Editors: lucideGlyph(lucideAppWindow, 18),
  'Anything else': lucideGlyph(lucideLink, 18),
};
const PickedIcon = lucideGlyph(lucideCheck, 14);

const MOVES: Record<string, (i: number, last: number) => number> = {
  ArrowRight: (i, last) => (i === last ? 0 : i + 1),
  ArrowDown: (i, last) => (i === last ? 0 : i + 1),
  ArrowLeft: (i, last) => (i === 0 ? last : i - 1),
  ArrowUp: (i, last) => (i === 0 ? last : i - 1),
  Home: () => 0,
  End: (_i, last) => last,
};

export function AppPicker({
  apps,
  picked,
  onPick,
}: {
  apps: readonly ConnectApp[];
  picked: ConnectAppId;
  onPick: (id: ConnectAppId) => void;
}) {
  const ids = useId();
  const buttons = useRef<Partial<Record<ConnectAppId, HTMLButtonElement | null>>>({});
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const at = apps.findIndex((app) => app.id === picked);
    const next = apps[move(at, apps.length - 1)]!;
    onPick(next.id);
    buttons.current[next.id]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="AI App"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      data-connect-apps=""
    >
      {apps.map((app) => {
        const on = app.id === picked;
        const Icon = GROUP_ICON[app.group];
        return (
          <button
            key={app.id}
            ref={(el) => {
              buttons.current[app.id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            // Named by the app's name; its line describes it.
            aria-labelledby={`${ids}-${app.id}`}
            aria-describedby={`${ids}-${app.id}-about`}
            tabIndex={on ? 0 : -1}
            data-connect-app={app.id}
            onClick={() => onPick(app.id)}
            onKeyDown={keyDown}
            className={`group relative flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              on
                ? 'border-brand-400 bg-brand-50 dark:border-brand-500/70 dark:bg-brand-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            <span
              aria-hidden
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors phone:hidden ${
                on
                  ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 group-hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-brand-300'
              }`}
            >
              <Icon />
            </span>
            <span className="min-w-0 flex-1 pr-3">
              <span
                id={`${ids}-${app.id}`}
                className="block truncate text-sm font-semibold text-slate-900 dark:text-white"
              >
                {app.name}
              </span>
              <span
                id={`${ids}-${app.id}-about`}
                className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-600 dark:text-slate-400"
              >
                {app.blurb}
              </span>
            </span>
            {on ? (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950 [&_svg]:size-2.5"
              >
                <PickedIcon />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
