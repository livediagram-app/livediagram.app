'use client';

// The Automations button in the footer (docs/specs/026-plan/automations.md "Where it lives"): between Search and
// Settings, for an Editor of the whole plan saved to an account, and for whoever can edit a plan in Browser Storage
// (it opens Rules Run on Our Servers there). No door from the host, no button. An amber dot says a rule paused itself.
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
  const label = paused ? 'Automations, a rule is paused' : 'Automations';
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
        {paused ? (
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
