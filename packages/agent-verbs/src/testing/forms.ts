// A document for the form verb suites (docs/specs/030-forms/forms.md "Agents"): a Board tab "Bugs" whose board takes
// only Bug cards, a Sheet tab "Budget", and a Form tab "Bug Report" sending Bug cards to New, its Severity a field.
import type { Tab } from '@livediagram/document';
import type { FormDefinition } from '@livediagram/forms';
import {
  ITEM_TYPES,
  READY_MADE_CARD_TYPES,
  presetSetup,
  type ItemTypeDef,
} from '@livediagram/items';
import type { FormDraft } from '../forms/form-draft';
import type { FormWorld, WorldTab } from '../forms/form-world';

const READY_BUG = READY_MADE_CARD_TYPES.find((t) => t.id === 'bug')!;
export const BUG: ItemTypeDef = {
  ...READY_BUG,
  fields: [...READY_BUG.fields, 'f-severity'],
  custom: [{ id: 'f-severity', label: 'Severity', kind: 'choice', options: ['Low', 'High'] }],
};

export const bugBoard = () => {
  const setup = { ...presetSetup('bug-triage'), addTypes: ['bug'] };
  return {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 900,
    height: 500,
    planBoard: setup,
  } as unknown as Tab['elements'][number];
};

export const firstStatus = () => presetSetup('bug-triage').columns[0]!.status;

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

export function formWorld(form: FormDefinition = bugForm()): FormWorld {
  const tabs: WorldTab[] = [
    { id: 'bugs', name: 'Bugs', kind: 'board', opensIn: 'plan', elements: [bugBoard()], rev: 4 },
    {
      id: 'budget',
      name: 'Budget',
      kind: 'sheet',
      opensIn: 'plan',
      rev: 1,
      elements: [
        {
          id: 'sh1',
          type: 'shape',
          shape: 'plan-sheet',
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          planSheet: { sheetId: 'sheet_budget' },
        } as unknown as Tab['elements'][number],
      ],
    },
    { id: 'form', name: 'Bug Report', kind: 'form', opensIn: 'plan', elements: [], form, rev: 7 },
  ];
  return {
    documentId: 'doc',
    documentName: 'Ops',
    tabs,
    types: [BUG, ...ITEM_TYPES],
    statuses: presetSetup('bug-triage').columns.map((c) => ({ status: c.status, name: c.name })),
    itemTypesRev: 3,
  };
}

let ids = 0;
export function formDraft(world: FormWorld = formWorld()): FormDraft {
  const tab = world.tabs.find((t) => t.kind === 'form')!;
  return {
    world,
    formTab: { id: tab.id, name: tab.name },
    form: tab.form as FormDefinition,
    types: [...world.types],
    typesChanged: false,
    newTabs: [],
    changedTabs: new Map(),
    lines: [],
    newId: (prefix) => `${prefix}-t${++ids}`,
  };
}
