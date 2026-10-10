'use client';

import { useState, type KeyboardEvent } from 'react';
import { Button, Select } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { DEFAULT_LINK_LEVEL } from '@livediagram/api-schema';
import type { ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { LIFETIMES, ROLE_PASS, SECTION_LABEL, ScopeOptions } from './share-dialog-parts';
import { ShareRolePicker } from './ShareRolePicker';

// "Issue a pass" (docs/specs/007-editor/live-app.md "Layout, top to bottom"): the role picker
// (docs/specs/013-workspace/share-roles.md), one card that unfolds the three roles, then the fine print: Opens (multi-tab only) and Valid, a sliding segmented control
// ending in the Create Pass button (which also copies the new link). Owns the draft pass; the
// dialog owns issuing it.
export function ShareComposer({
  tabs,
  busy,
  onIssue,
}: {
  tabs: { id: string; name: string }[];
  busy: boolean;
  onIssue: (role: ShareRole, expiry: ShareLinkExpiry, tabId: string | null) => void;
}) {
  const [role, setRole] = useState<ShareRole>(DEFAULT_LINK_LEVEL);
  // Never = the pre-expiry default (docs/specs/013-workspace/share-link-expiry.md): works until revoked.
  const [expiry, setExpiry] = useState<ShareLinkExpiry>('never');
  // '' = All tabs, else a tab id (docs/specs/013-workspace/tab-scoped-share-links.md). Only offered
  // when there is more than one tab to choose between.
  const [scope, setScope] = useState('');
  const multiTab = tabs.length > 1;

  // Arrow keys walk the lifetimes, wrapping, as in any radio group.
  const onLifetimeKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = LIFETIMES.findIndex((l) => l.value === expiry);
    const next = LIFETIMES[(i + step + LIFETIMES.length) % LIFETIMES.length]!.value;
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
      {/* The role and the fine print share one tinted panel, so the pass being made reads as one thing. */}
      <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
        <ShareRolePicker role={role} onChange={setRole} />

        {/* The pass's fine print: one labelled row per term, labels in one
          column so the terms read as a block rather than loose dropdowns.
          Create Pass ends the Valid row, the last choice before issuing, so
          the lifetime reads as part of making the pass. */}
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
            <HelpArticleLink article="shareLinkExpiry" />
          </span>
          <div
            role="radiogroup"
            aria-label="Link lifetime"
            // A ring, not a border, so the selection fills the track: the same height as Create Pass beside it.
            className="relative grid h-9 grid-cols-4 rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            {/* The selection slides to the picked lifetime, like the Explorer tabs. */}
            <SegmentSlider
              count={LIFETIMES.length}
              index={LIFETIMES.findIndex((l) => l.value === expiry)}
              className={`${ROLE_PASS[role].solid} shadow-sm`}
              flush
            />
            {LIFETIMES.map(({ value, label }) => {
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
                  className={`relative z-10 h-full rounded-md px-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="text-optical-line">{label}</span>
                </button>
              );
            })}
          </div>
          <Button
            onClick={() => onIssue(role, expiry, multiTab && scope ? scope : null)}
            disabled={busy}
            // The same height as the Valid control beside it, so the row reads as one line.
            className="h-9 shadow-sm whitespace-nowrap"
          >
            Create Pass
          </Button>
        </div>
      </div>
    </section>
  );
}
