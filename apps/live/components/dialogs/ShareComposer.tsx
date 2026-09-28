'use client';

import { useState, type KeyboardEvent } from 'react';
import { Button, CheckIcon, Select } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { ROLE_PASS, SECTION_LABEL, ScopeOptions } from './share-dialog-parts';

const ROLES: ShareRole[] = ['edit', 'view'];

// "Issue a pass" (docs/specs/007-editor/live-app.md "Layout, top to bottom"): two role cards as a
// radio group, a sentence of options (the tabs it opens, how long it is valid), and one
// full-width Create & Copy button. Owns the draft pass; the dialog owns issuing it.
export function ShareComposer({
  tabs,
  busy,
  onIssue,
}: {
  tabs: { id: string; name: string }[];
  busy: boolean;
  onIssue: (role: ShareRole, expiry: ShareLinkExpiry, tabId: string | null) => void;
}) {
  const [role, setRole] = useState<ShareRole>('edit');
  // Never = the pre-expiry default (docs/specs/013-workspace/share-link-expiry.md): works until revoked.
  const [expiry, setExpiry] = useState<ShareLinkExpiry>('never');
  // '' = All tabs, else a tab id (docs/specs/013-workspace/tab-scoped-share-links.md). Only offered
  // when there is more than one tab to choose between.
  const [scope, setScope] = useState('');
  const multiTab = tabs.length > 1;

  // Arrow keys move between the two cards, as in any radio group.
  const onRoleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next: ShareRole = role === 'edit' ? 'view' : 'edit';
    setRole(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-role="${next}"]`)
      ?.focus();
  };

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="share-issue-heading">
      <p id="share-issue-heading" className={SECTION_LABEL}>
        Issue a pass
      </p>
      <div
        role="radiogroup"
        aria-label="What the pass lets people do"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {ROLES.map((r) => {
          const pass = ROLE_PASS[r];
          const { Icon } = pass;
          const active = role === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-role={r}
              onClick={() => setRole(r)}
              onKeyDown={onRoleKey}
              className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                active
                  ? pass.selected
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${
                  active
                    ? pass.solid
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <Icon />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {pass.title}
                </span>
                <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  {pass.blurb}
                </span>
              </span>
              {active ? (
                <span
                  aria-hidden
                  className={`absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full ${pass.solid}`}
                >
                  <CheckIcon size={10} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* The options read as a sentence printed on the pass-to-be. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        {multiTab ? (
          <label className="inline-flex items-center gap-1.5">
            Opens
            <Select
              size="sm"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Tabs this link opens"
              className="max-w-40"
            >
              <ScopeOptions tabs={tabs} />
            </Select>
          </label>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <label className="inline-flex items-center gap-1.5">
            Valid
            <Select
              size="sm"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as ShareLinkExpiry)}
              aria-label="Link lifetime"
            >
              <option value="never">Never expires</option>
              <option value="week">For 1 week</option>
              <option value="month">For 1 month</option>
              <option value="sixMonths">For 6 months</option>
            </Select>
          </label>
          <HelpArticleLink article="shareLinkExpiry" />
        </span>
      </div>

      <Button
        onClick={() => onIssue(role, expiry, multiTab && scope ? scope : null)}
        disabled={busy}
        className="w-full shadow-sm"
      >
        {`Create & Copy ${ROLE_PASS[role].stamp} Pass`}
      </Button>
    </section>
  );
}
