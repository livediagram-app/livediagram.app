'use client';

// A For Related Cards branch's panel (docs/specs/026-plan/automations.md "For Related Cards"): which of the card's
// related cards it runs on (Linked Cards through one Card field or any, the cards it is blocked by, the cards it
// blocks, its child cards, or the cards matching a board's saved filter). Its own conditions and actions sit under
// the step, each opening its own panel.

import {
  AUTOMATION_BRANCH_ACTIONS_MAX,
  AUTOMATION_BRANCH_CARDS_MAX,
  type AutomationBranch,
  type AutomationRelated,
} from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';
import { SavedFilterSelect } from './SavedFilterConditionPanel';

type RelatedKind = AutomationRelated['kind'];

export const RELATED_CHOICES: readonly { kind: RelatedKind; label: string; hint: string }[] = [
  {
    kind: 'linked',
    label: 'Linked Cards',
    hint: 'The cards a Card field of this card points at.',
  },
  { kind: 'blocked_by', label: 'Blocked By Cards', hint: 'The cards this card is blocked by.' },
  { kind: 'blocking', label: 'Cards It Blocks', hint: 'The cards this card is blocking.' },
  { kind: 'children', label: 'Child Cards', hint: 'The cards whose parent is this card.' },
  {
    kind: 'saved_filter',
    label: 'Cards Matching a Saved Filter',
    hint: 'Every card a board’s saved filter shows, but this one.',
  },
];

/** The plan's Card fields (a field pointing at other cards), each once, by name. */
export function cardFields(outline: Pick<AutomationOutline, 'types'>) {
  const seen = new Map<string, string>();
  for (const t of outline.types)
    for (const f of t.custom ?? [])
      if (f.kind === 'card' && t.fields.includes(f.id) && !seen.has(f.id)) seen.set(f.id, f.label);
  return [...seen].map(([id, name]) => ({ id, name }));
}

function freshRelated(kind: RelatedKind, outline: AutomationOutline): AutomationRelated {
  if (kind !== 'saved_filter') return { kind };
  const board = outline.boards.find((b) => b.filters.length > 0);
  return { kind, tab: board?.tabId ?? '', filter: board?.filters[0]?.id ?? '' };
}

export function BranchPanel({
  step,
  onChange,
  outline,
}: {
  step: AutomationBranch;
  onChange: (next: AutomationBranch) => void;
  outline: AutomationOutline;
}) {
  const related = step.related;
  const choice = RELATED_CHOICES.find((c) => c.kind === related.kind);
  const fields = cardFields(outline);
  const set = (next: AutomationRelated) => onChange({ ...step, related: next });
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="For Each" hint={choice?.hint}>
        {(id) => (
          <PanelSelect
            id={id}
            value={related.kind}
            onChange={(e) => set(freshRelated(e.target.value as RelatedKind, outline))}
          >
            {RELATED_CHOICES.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.label}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {related.kind === 'linked' ? (
        <PanelField label="Through">
          {(id) => (
            <PanelSelect
              id={id}
              value={related.field ?? ''}
              onChange={(e) =>
                set(e.target.value ? { kind: 'linked', field: e.target.value } : { kind: 'linked' })
              }
            >
              <option value="">Any Card Field</option>
              {related.field && !fields.some((f) => f.id === related.field) ? (
                <option value={related.field}>A field no longer here</option>
              ) : null}
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {related.kind === 'saved_filter' ? (
        <SavedFilterSelect
          tab={related.tab}
          filter={related.filter}
          outline={outline}
          hint="Applied as the person who made the change would see it."
          onPick={(tab, filter) => set({ kind: 'saved_filter', tab, filter })}
        />
      ) : null}
      <PanelNote>
        Its own conditions and up to {AUTOMATION_BRANCH_ACTIONS_MAX} actions sit under the step, and
        run on each related card (up to {AUTOMATION_BRANCH_CARDS_MAX}, the first by number). In its
        text, Card values are the related card’s and Trigger values the card that started the rule.
      </PanelNote>
    </div>
  );
}
