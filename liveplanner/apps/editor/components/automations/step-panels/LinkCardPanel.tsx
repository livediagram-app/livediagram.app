'use client';

// Link Cards (docs/specs/026-plan/automations.md "Actions"): one of the plan's Card fields (a Blocked By field too),
// pointed at a card picked here or, inside a branch, at the card that started the rule. A field of several cards
// gains it; a single one is replaced.

import { useId, useMemo, useState } from 'react';
import { itemTitle, type AutomationAction } from '@liveplanner/items';
import { Button } from '@liveplanner/ui';
import { CardPickerDialog } from '@/components/plan/CardPickerDialog';
import { byNewestChange, pickCardOf, useCardPickerSearch } from '@/components/plan/card-picker';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelSelect } from './panel-parts';

type LinkAction = AutomationAction & { kind: 'link_card' };

// The plan's Card fields, once each by id.
function cardFields(outline: AutomationOutline) {
  const seen = new Map<string, { id: string; label: string; blocks: boolean }>();
  for (const t of outline.types)
    for (const f of t.custom ?? [])
      if (f.kind === 'card' && !seen.has(f.id))
        seen.set(f.id, { id: f.id, label: f.label, blocks: f.blocks === true });
  return [...seen.values()];
}

const TRIGGER = 'trigger';
const CHOSEN = 'card';

export function LinkCardPanel({
  action,
  onChange,
  outline,
  branch,
  invalid,
}: {
  action: LinkAction;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  branch: boolean;
  invalid: boolean;
}) {
  const fields = useMemo(() => cardFields(outline), [outline]);
  const [picking, setPicking] = useState(false);
  const rows = useMemo(
    () => [...outline.items.values()].map((i) => pickCardOf(i, outline.types)).sort(byNewestChange),
    [outline.items, outline.types],
  );
  const picker = useCardPickerSearch(rows);
  const known = fields.some((f) => f.id === action.field);
  const to = 'trigger' in action.to ? TRIGGER : CHOSEN;
  const chosen =
    'card' in action.to && action.to.card ? outline.items.get(action.to.card) : undefined;
  // A card the rule holds that the plan has since lost: shown as gone, never as nothing picked.
  const gone = 'card' in action.to && !!action.to.card && !chosen;
  const cardLineId = useId();
  if (!fields.length)
    return (
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        This plan has no Card fields yet. Add one to a card type (Blocked By is one) to link cards.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Field">
        {(id) => (
          <PanelSelect
            id={id}
            value={action.field}
            onChange={(e) => onChange({ ...action, field: e.target.value })}
          >
            {known ? null : <option value={action.field}>A field no longer here</option>}
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {f.blocks ? ' (Blocked By)' : ''}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {branch ? (
        <PanelField label="Link To">
          {(id) => (
            <PanelSelect
              id={id}
              value={to}
              onChange={(e) =>
                onChange({
                  ...action,
                  to: e.target.value === TRIGGER ? { trigger: true } : { card: '' },
                })
              }
            >
              <option value={TRIGGER}>The Card That Started the Rule</option>
              <option value={CHOSEN}>A Card I Pick</option>
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {to === CHOSEN ? (
        <PanelField label="Card">
          {(id) => (
            <div
              className={`flex h-11 items-center gap-2 rounded-lg border bg-white pl-3 pr-1.5 dark:bg-slate-900 ${invalid && !chosen ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
            >
              <span
                id={cardLineId}
                className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50"
              >
                {chosen ? (
                  <>
                    <span className="mr-1 text-slate-500 dark:text-slate-400">#{chosen.key}</span>
                    {itemTitle(chosen)}
                  </>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {gone ? 'A card no longer here' : 'No card picked'}
                  </span>
                )}
              </span>
              <Button
                id={id}
                variant="secondary"
                size="xs"
                aria-label={chosen || gone ? 'Change Card' : 'Pick a Card'}
                aria-describedby={cardLineId}
                aria-haspopup="dialog"
                onClick={() => setPicking(true)}
              >
                {chosen || gone ? 'Change' : 'Pick a Card'}
              </Button>
            </div>
          )}
        </PanelField>
      ) : null}
      {picking ? (
        <CardPickerDialog
          title="Pick a Card to Link"
          description="The card this rule's card will point at."
          cards={picker.shown}
          query={picker.query}
          onQuery={picker.setQuery}
          listLabel="Cards in this plan"
          emptyText="This plan has no cards to link yet."
          showType={outline.types.length > 1}
          onPick={(card) => {
            setPicking(false);
            onChange({ ...action, to: { card: card.itemId } });
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
