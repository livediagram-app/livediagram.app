// A document for the form verb suites (docs/specs/030-forms/forms.md "Agents"): a Board tab "Bugs" whose board takes
// only Bug cards, a Sheet tab "Budget", and a Form tab "Bug Report" sending Bug cards to New, its Severity a field.
import type { PlanResponse } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { FormDefinition } from '@livediagram/forms';
import {
  ITEM_TYPES,
  READY_MADE_CARD_TYPES,
  presetSetup,
  type ItemTypeDef,
} from '@livediagram/items';
import { draftOf, type FormDraft } from '../forms/form-draft';
import { worldOf, type FormTabBody, type FormWorld } from '../forms/form-world';

const READY_BUG = READY_MADE_CARD_TYPES.find((t) => t.id === 'bug')!;
export const BUG: ItemTypeDef = {
  ...READY_BUG,
  fields: [...READY_BUG.fields, 'f-severity'],
  custom: [{ id: 'f-severity', label: 'Severity', kind: 'choice', options: ['Low', 'High'] }],
};

const triage = presetSetup('bug-triage');
export const firstStatus = () => triage.columns[0]!.status;

export const bugForm = (): FormDefinition => ({
  v: 1,
  heading: 'Bug Report',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-sum', type: 'short', prompt: 'Summary', required: true, goesTo: { to: 'title' } },
        {
          id: 'q-sev',
          type: 'single',
          prompt: 'Severity',
          options: ['Low', 'High'],
          goesTo: { to: 'field', fieldId: 'f-severity' },
        },
        { id: 'q-ok', type: 'checkbox', prompt: 'Can we contact you?' },
      ],
    },
  ],
  destination: { tabId: 'bugs', typeId: 'bug', status: firstStatus() },
});

// The document's plan as the api answers it.
export function formPlan(): PlanResponse {
  return {
    boards: [
      {
        tabId: 'bugs',
        tabName: 'Bugs',
        elementId: 'b1',
        title: triage.title,
        kind: 'board',
        types: ['bug'],
        columns: triage.columns.map((c) => ({ status: c.status, name: c.name })),
      },
    ],
    statuses: triage.columns.map((c) => ({ status: c.status, name: c.name })),
    types: [BUG, ...ITEM_TYPES],
    tabs: [
      { id: 'bugs', name: 'Bugs', kind: 'board' },
      { id: 'budget', name: 'Budget', kind: 'sheet', sheetIds: ['sheet_budget'] },
      { id: 'form', name: 'Bug Report', kind: 'form', theme: 'ocean' },
    ],
    itemTypesRev: 3,
  };
}

export const formWorld = (): FormWorld => worldOf('doc', formPlan());

export const formTabBody = (form: FormDefinition = bugForm()): FormTabBody =>
  ({
    id: 'form',
    name: form.heading,
    kind: 'form',
    opensIn: 'plan',
    elements: [],
    form,
    rev: 7,
  }) as Tab & FormTabBody;

let ids = 0;
export function formDraft(
  form: FormDefinition = bugForm(),
  world: FormWorld = formWorld(),
): FormDraft {
  return draftOf(
    world,
    { id: 'form', name: form.heading, theme: 'ocean' },
    form,
    (p) => `${p}-t${++ids}`,
  );
}
