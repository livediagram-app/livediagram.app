'use client';

// The Automations row in the footer's Tools menu (docs/specs/026-plan/automations.md "The footer button"): there for
// an Editor of the whole plan saved to an account, and for whoever can edit a plan in Browser Storage (it opens Rules
// Run on Our Servers there). No door from the host, no row. A badge at its right edge counts the rules that are on
// (none at 0); a rule that paused itself turns it amber and puts an amber dot on the Tools button. It reads the list
// the host fetched once the plan settled, never fetching its own.

import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useAutomationsAccess, useAutomationsDoor } from './AutomationsContext';
import { BoltIcon } from './automation-glyphs';
import { useAutomations } from './use-automations';

export function useAutomationsToolsItem(): ChromeToolsItem | null {
  const door = useAutomationsDoor();
  const access = useAutomationsAccess();
  const { data } = useAutomations(access?.scope ?? null, false);
  if (!door) return null;
  const paused = data?.rules.some((r) => !!r.paused) ?? false;
  const on = data?.rules.filter((r) => r.enabled).length ?? 0;
  return {
    id: 'automations',
    group: 'automate',
    // The ellipsis: it opens its own modal, outside Tools.
    label: 'Automations…',
    description: 'Rules that act on cards for you.',
    icon: <BoltIcon size={16} />,
    // Like Search, it opens its own full-size modal rather than inside Tools: a whole screen of rules
    // (footer-tools-menu.md "Opening a tool inside Tools", the exceptions).
    ...(door.badges ? { badges: door.badges } : {}),
    onSelect: door.open,
    aside: on ? (
      <span
        role="img"
        aria-label={`${on} on`}
        data-automations-count=""
        className={`inline-flex h-4 min-w-4 items-center justify-center rounded-[5px] px-1 text-[10px] font-semibold leading-none tabular-nums ${
          paused
            ? 'bg-amber-500 text-amber-950'
            : 'bg-slate-900/[0.08] text-slate-600 dark:bg-white/10 dark:text-slate-300'
        }`}
      >
        {on > 99 ? '99+' : on}
      </span>
    ) : undefined,
    ...(paused ? { attention: 'amber' as const, attentionLabel: 'a rule is paused' } : {}),
  };
}
