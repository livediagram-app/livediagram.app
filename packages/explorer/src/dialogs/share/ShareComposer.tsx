'use client';

// "Issue a pass": the level picker (one card, Editor to start, that unfolds the three levels), then the fine print,
// Opens (when the item has more than one tab) and Valid, a sliding segmented control ending in Create Pass, which also
// copies the new link. It owns the draft pass; the dialog issues it.

import { useState, type KeyboardEvent } from 'react';
import { SHARE_LINK_EXPIRIES, type Level, type ShareLinkExpiry } from '@liveworkspace/index-client';
import { Button, Select } from '@liveworkspace/ui';
import { HelpLink } from './HelpLink';
import {
  DEFAULT_LEVEL,
  LEVEL_PASS,
  LIFETIMES,
  SECTION_LABEL,
  ScopeOptions,
  type ShareTab,
} from './parts';
import { RolePicker, SegmentSlider } from './RolePicker';
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

  // Arrow keys walk the lifetimes, wrapping, as in any radio group.
  const step = (e: KeyboardEvent<HTMLButtonElement>) =>
    ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 })[e.key];
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
      {/* The level and the fine print share one tinted panel, so the pass being made reads as one thing. */}
      <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
        <div data-tour-id="share-role">
          <RolePicker level={level} onChange={setLevel} />
        </div>
        {/* The fine print: one labelled row per term, labels in one column, Create Pass ending the Valid row. */}
        <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-0.5 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-y-2">
          {multiTab ? (
            <>
              <label
                htmlFor="share-new-scope"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Opens
              </label>
              <Select
                id="share-new-scope"
                data-tour-id="share-scope"
                className="sm:col-span-2"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                aria-label="Tabs this link opens"
              >
                <ScopeOptions tabs={tabs} />
              </Select>
            </>
          ) : null}
          <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Valid
            <HelpLink
              href={helpHref?.('shareLinkExpiry')}
              label="How link lifetimes work"
              description="When a pass stops working, and how to extend it."
            />
          </span>
          <div
            role="radiogroup"
            aria-label="Link lifetime"
            data-tour-id="share-valid"
            // A ring, not a border, so the selection fills the track: the height of Create Pass beside it.
            className="relative grid h-9 grid-cols-4 rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            {/* The selection slides to the picked lifetime. */}
            <SegmentSlider
              count={SHARE_LINK_EXPIRIES.length}
              index={SHARE_LINK_EXPIRIES.indexOf(expiry)}
              className={`${LEVEL_PASS[level].solid} shadow-sm`}
            />
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
                  className={`relative z-10 h-full whitespace-nowrap rounded-md px-1 text-xs font-medium transition-colors duration-micro ${
                    active
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="text-optical-line">{LIFETIMES[value]}</span>
                </button>
              );
            })}
          </div>
          <Button
            variant="solid"
            onClick={() => onIssue(level, expiry, multiTab && scope ? scope : null)}
            busy={busy}
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
