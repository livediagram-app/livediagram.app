'use client';

// The When panel's Trigger field (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): the trigger's
// tile, name and what it hears, and Change, which opens the Pick a Trigger picker (TilePicker) with the current one
// badged. The groups are the app's (kit.kinds.triggerGroups); one it does not offer here (kit.kinds.useOffer) shows
// only for a rule already on one of its kinds.

import { useMemo, useState } from 'react';
import { automationsHeroArt } from '../AutomationsHeroArt';
import { StepTile } from '../glyphs';
import { useAutomationsKit, useAutomationsOffer } from '../kit-context';
import { TilePicker } from '../tile-picker/TilePicker';
import { ChangeRow, PanelField } from './panel-parts';

export function ChangeTriggerField({
  kind,
  onChange,
}: {
  kind: string;
  onChange: (kind: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const kit = useAutomationsKit();
  const { triggers, triggerGroups } = kit.kinds;
  const offer = useAutomationsOffer(open);
  const hidden = offer.hiddenTriggerGroups;
  const notes = offer.triggerGroupNotes;
  const sections = useMemo(
    () =>
      triggerGroups
        .filter((g) => !hidden?.has(g.id) || g.kinds.includes(kind))
        .map((g) => ({
          id: g.id,
          name: g.name,
          ...(notes?.[g.id] ? { note: notes[g.id]! } : g.note ? { note: g.note } : {}),
          tiles: g.kinds.map((k) => ({
            key: k,
            name: triggers[k]!.name,
            line: triggers[k]!.line,
            icon: <StepTile tone="trigger" time={!!triggers[k]!.time} size={24} />,
            scene: triggers[k]!.scene(g.id),
          })),
        })),
    [triggerGroups, triggers, hidden, notes, kind],
  );
  const now = triggers[kind];
  return (
    <PanelField label="Trigger" hint={now?.line}>
      {(id) => (
        <>
          <ChangeRow
            id={id}
            noun="Trigger"
            icon={<StepTile tone="trigger" time={!!now?.time} size={24} />}
            name={now?.name ?? ''}
            open={open}
            onOpen={() => setOpen(true)}
          />
          {open ? (
            <TilePicker
              title="Pick a Trigger"
              line="When should this rule run?"
              art={automationsHeroArt}
              noun="trigger"
              emptyHint={kit.kinds.triggerHint}
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
