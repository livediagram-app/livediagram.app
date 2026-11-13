'use client';

// The Automations button in the footer (docs/specs/026-plan/automations.md "Where it lives"): between Search and
// Settings, for an Editor of the whole plan saved to an account, and for whoever can edit a plan in Browser Storage
// (it opens Rules Run on Our Servers there). No door from the host, no button. A badge counts the rules
// that are on (none at 0); a rule that paused itself turns it amber, or with no badge puts an amber dot on the icon.
// It reads the list the host fetched once the plan settled, never fetching its own.

import { HoverCard } from '@liveplanner/ui';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { useAutomationsAccess, useAutomationsDoor } from './AutomationsContext';
import { BoltIcon } from './automation-glyphs';
import { useAutomations } from './use-automations';

export function AutomationsButton({ labelled = false }: { labelled?: boolean }) {
  const door = useAutomationsDoor();
  const access = useAutomationsAccess();
  const { data } = useAutomations(access?.scope ?? null, false);
  if (!door) return null;
  const paused = data?.rules.some((r) => !!r.paused) ?? false;
  // The rules that are on: a badge beside the button, none at 0.
  const on = data?.rules.filter((r) => r.enabled).length ?? 0;
  const label = [
    'Automations',
    ...(on ? [`${on} on`] : []),
    ...(paused ? ['a rule is paused'] : []),
  ].join(', ');
  return (
    <HoverCard
      title="Automations"
      description={
        paused
          ? 'A rule paused itself after failing. Open Automations to see why.'
          : 'Rules that move, assign and tell people about cards for you.'
      }
    >
      <button
        type="button"
        onClick={door.open}
        aria-label={label}
        data-automations-button=""
        className={`relative ${labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}`}
      >
        <BoltIcon size={14} />
        <ChromeLabel show={labelled}>Automations</ChromeLabel>
        {on ? (
          <span
            aria-hidden
            data-automations-count=""
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-[5px] px-1 text-[10px] font-semibold leading-none tabular-nums ${
              labelled ? '' : 'absolute -right-1 -top-1 ring-2 ring-white dark:ring-slate-900'
            } ${
              paused
                ? 'bg-amber-500 text-amber-950'
                : 'bg-slate-900/[0.08] text-slate-600 dark:bg-white/10 dark:text-slate-300'
            }`}
          >
            {on > 99 ? '99+' : on}
          </span>
        ) : paused ? (
          <span
            aria-hidden
            data-automations-paused=""
            className="absolute right-1 top-1 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
          />
        ) : null}
      </button>
    </HoverCard>
  );
}
