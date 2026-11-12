'use client';

// The card actions with a single pick (docs/specs/026-plan/automations.md "Actions"): Change Card Type (one of the
// plan's card types), Set Colour (a standard colour, or none) and Copy Card (its own column, or one chosen).

import type { AutomationAction } from '@liveplanner/items';
import { ColourSelect } from '@/components/plan/ColourSwatches';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

export function SetTypePanel({
  action,
  onChange,
  outline,
}: {
  action: AutomationAction & { kind: 'set_type' };
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
}) {
  const known = outline.types.some((t) => t.id === action.type);
  return (
    <PanelField label="Card Type" hint="The card keeps its column only if the new type takes it.">
      {(id) => (
        <PanelSelect
          id={id}
          value={action.type}
          onChange={(e) => onChange({ kind: 'set_type', type: e.target.value })}
        >
          {known ? null : <option value={action.type}>A card type no longer here</option>}
          {outline.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}

export function SetColourPanel({
  action,
  onChange,
}: {
  action: AutomationAction & { kind: 'set_colour' };
  onChange: (next: AutomationAction) => void;
}) {
  return (
    <PanelField label="Colour" hint="None takes the card’s colour off.">
      {(id) => (
        <ColourSelect
          id={id}
          value={action.colour ?? undefined}
          onChange={(colour) => onChange({ kind: 'set_colour', colour: colour ?? null })}
        />
      )}
    </PanelField>
  );
}

// The select's value for "its own column".
const OWN = '';

export function CopyCardPanel({
  action,
  onChange,
  outline,
}: {
  action: AutomationAction & { kind: 'copy_card' };
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
}) {
  const status = action.status ?? OWN;
  const known = status === OWN || outline.columns.some((c) => c.status === status);
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Column">
        {(id) => (
          <PanelSelect
            id={id}
            value={status}
            onChange={(e) =>
              onChange(
                e.target.value === OWN
                  ? { kind: 'copy_card' }
                  : { kind: 'copy_card', status: e.target.value },
              )
            }
          >
            <option value={OWN}>The Card’s Own Column</option>
            {known ? null : <option value={status}>A column no longer here</option>}
            {outline.columns.map((c) => (
              <option key={c.status} value={c.status}>
                {c.name}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <PanelNote>
        The copy takes the card’s type, title and fields. A run makes one card at most.
      </PanelNote>
    </div>
  );
}
