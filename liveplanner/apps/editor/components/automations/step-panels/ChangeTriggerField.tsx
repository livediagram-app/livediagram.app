'use client';

// The When panel's Trigger field (docs/specs/026-plan/automations.md "The rule builder"): the trigger's tile, name and
// what it hears, and Change, which opens the Pick a Trigger picker (StepPicker) with the current one badged.

import { useMemo, useState } from 'react';
import { AUTOMATION_TRIGGER_NAMES, type AutomationTriggerKind } from '@liveplanner/items';
import { Button } from '@liveplanner/ui';
import { automationsHeroArt } from '../AutomationsHeroArt';
import { StepTile } from '../automation-glyphs';
import { StepPicker } from '../StepPicker';
import { useGithubAutomations } from '../github/github-automations';
import { useGithubConnection } from '../github/use-github-connection';
import { TRIGGER_LINES, isTimeKind, offeredGroups } from '../trigger-groups';
import type { AutomationsScope } from '../automations-client';
import { TriggerScene } from '../TriggerScene';
import { PanelField } from './panel-parts';

// No plan: the connection is never read outside the Automations dialog.
const NO_SCOPE: AutomationsScope = { ownerId: '', projectId: '', shareCode: null };

export function ChangeTriggerField({
  kind,
  onChange,
}: {
  kind: AutomationTriggerKind;
  onChange: (kind: AutomationTriggerKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const gh = useGithubAutomations();
  const github = useGithubConnection(gh?.scope ?? NO_SCOPE, open && !!gh?.enabled);
  const unconnected = github.status === 'ready' && !github.connection;
  const sections = useMemo(
    () =>
      offeredGroups(!!gh?.enabled, kind).map((g) => ({
        id: g.id,
        name: g.name,
        ...(g.id === 'github' && unconnected ? { note: 'Not Connected' } : {}),
        tiles: g.kinds.map((k) => ({
          key: k,
          name: AUTOMATION_TRIGGER_NAMES[k],
          line: TRIGGER_LINES[k],
          icon: <StepTile tone="trigger" time={isTimeKind(k)} size={24} />,
          scene: <TriggerScene kind={k} group={g.id} />,
        })),
      })),
    [gh?.enabled, kind, unconnected],
  );
  return (
    <PanelField label="Trigger" hint={TRIGGER_LINES[kind]}>
      {(id) => (
        <>
          <div className="flex h-11 items-center gap-2.5 rounded-lg border border-slate-200 bg-white pl-2 pr-1.5 dark:border-slate-700 dark:bg-slate-900">
            <StepTile tone="trigger" time={isTimeKind(kind)} size={24} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {AUTOMATION_TRIGGER_NAMES[kind]}
            </span>
            <Button
              id={id}
              variant="secondary"
              size="xs"
              data-change-step=""
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              Change
            </Button>
          </div>
          {open ? (
            <StepPicker
              title="Pick a Trigger"
              line="When should this rule run?"
              art={automationsHeroArt}
              noun="trigger"
              emptyHint="Try another word, such as “moved”, “due” or “form”."
              sections={sections}
              current={kind}
              onPick={(k) => {
                setOpen(false);
                if (k !== kind) onChange(k);
              }}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      )}
    </PanelField>
  );
}
