'use client';

// "Issue a pass": the level cards (Editor first, and chosen), then the fine print, Opens (when the item has more
// than one tab) and Valid, ending in Create Pass, which also copies the new link. It owns the draft pass; the
// dialog issues it.

import { useState, type KeyboardEvent } from 'react';
import { SHARE_LINK_EXPIRIES, type Level, type ShareLinkExpiry } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { HelpLink } from './HelpLink';
import {
  DEFAULT_LEVEL,
  LEVEL_ORDER,
  LEVEL_PASS,
  LIFETIMES,
  SECTION_LABEL,
  SELECT,
  ScopeOptions,
  type ShareTab,
} from './parts';
import type { ShareHelpHref } from './types';

export function ShareComposer({
  tabs,
  busy,
  helpHref,
  onIssue,
}: {
  tabs: ShareTab[];
  busy: boolean;
  helpHref?: ShareHelpHref;
  onIssue: (level: Level, expiry: ShareLinkExpiry, tabId: string | null) => void;
}) {
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [expiry, setExpiry] = useState<ShareLinkExpiry>('never');
  const [scope, setScope] = useState('');
  const multiTab = tabs.length > 1;

  // Arrow keys walk a radio group, wrapping.
  const step = (e: KeyboardEvent<HTMLButtonElement>) =>
    ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 })[e.key];
  const onLevelKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = step(e);
    if (!by) return;
    e.preventDefault();
    const i = LEVEL_ORDER.indexOf(level);
    const next = LEVEL_ORDER[(i + by + LEVEL_ORDER.length) % LEVEL_ORDER.length]!;
    setLevel(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)
      ?.focus();
  };
  const onLifetimeKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = step(e);
    if (!by) return;
    e.preventDefault();
    const i = SHARE_LINK_EXPIRIES.indexOf(expiry);
    const n = SHARE_LINK_EXPIRIES.length;
    const next = SHARE_LINK_EXPIRIES[(i + by + n) % n]!;
    setExpiry(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-lifetime="${next}"]`)
      ?.focus();
  };

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="share-issue-heading">
      <p id="share-issue-heading" className={SECTION_LABEL}>
        Issue a pass
      </p>
      <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
        <div
          role="radiogroup"
          aria-label="Level"
          data-tour-id="share-role"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {LEVEL_ORDER.map((l) => {
            const pass = LEVEL_PASS[l];
            const on = level === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                data-level={l}
                onClick={() => setLevel(l)}
                onKeyDown={onLevelKey}
                className={`flex flex-col items-start gap-1 rounded-lg border bg-white p-2.5 text-left transition dark:bg-slate-900 ${
                  on
                    ? pass.selected
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <pass.Icon />
                  {pass.title}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{pass.blurb}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-0.5 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-y-2">
          {multiTab ? (
            <>
              <label
                htmlFor="share-new-scope"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Opens
              </label>
              <select
                id="share-new-scope"
                data-tour-id="share-scope"
                className={`${SELECT} sm:col-span-2`}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                aria-label="Tabs this link opens"
              >
                <ScopeOptions tabs={tabs} />
              </select>
            </>
          ) : null}
          <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Valid
            <HelpLink href={helpHref?.('shareLinkExpiry')} label="How link lifetimes work" />
          </span>
          <div
            role="radiogroup"
            aria-label="Link lifetime"
            data-tour-id="share-valid"
            className="grid h-9 grid-cols-4 gap-0.5 rounded-lg bg-white p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            {SHARE_LINK_EXPIRIES.map((value) => {
              const active = expiry === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  data-lifetime={value}
                  onClick={() => setExpiry(value)}
                  onKeyDown={onLifetimeKey}
                  className={`h-full whitespace-nowrap rounded-md px-1 text-xs font-medium transition-colors ${
                    active
                      ? `${LEVEL_PASS[level].solid} shadow-sm`
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {LIFETIMES[value]}
                </button>
              );
            })}
          </div>
          <Button
            variant="solid"
            onClick={() => onIssue(level, expiry, multiTab && scope ? scope : null)}
            disabled={busy}
            data-tour-id="share-create"
            className={`h-9 whitespace-nowrap shadow-sm ${LEVEL_PASS[level].button}`}
          >
            Create Pass
          </Button>
        </div>
      </div>
    </section>
  );
}
