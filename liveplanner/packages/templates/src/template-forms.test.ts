import {
  buildStarter,
  destinationProblem,
  formStarter,
  publishProblems,
  questionsOf,
  readForm,
  type FormDefinition,
} from '@liveplanner/forms';
import { READY_MADE_CARD_TYPES } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { describe, expect, it } from 'vitest';
import { PLAN_TEMPLATE_KINDS, PLAN_TEMPLATE_TABS, type BoardSpec } from './plan-template-catalogue';
import { boardSetup, planTemplateTabs } from './template-builders-plan';
import {
  boardResponseType,
  starterWithFields,
  templateForm,
  templateFormTarget,
} from './template-forms';
import { buildTemplateTabs } from './template-tab';

// docs/specs/030-forms/forms.md "In a plan template", blueprint §7a.

type Kind = (typeof PLAN_TEMPLATE_KINDS)[number];

// A template's tabs as one path makes them: ids t0, t1..., each tab's elements and fields.
function made(kind: Kind) {
  const defs = planTemplateTabs(kind);
  const ids = defs.map((_, i) => `t${i}`);
  return defs.map((d, i) => ({
    id: ids[i]!,
    name: d.name,
    elements: d.build(0, 0),
    ...d.tab?.(ids),
  }));
}

const formOf = (kind: Kind, name: string): FormDefinition => {
  const tab = made(kind).find((t) => t.name === name);
  expect(tab?.kind).toBe('form');
  return tab!.form!;
};

const boardsOn = (tab: { elements: Tab['elements'] } | undefined) =>
  (tab?.elements ?? []).flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' && el.planBoard ? [el.planBoard] : [],
  );

const ticket = READY_MADE_CARD_TYPES.find((t) => t.id === 'ticket')!;

describe('Help Desk’s Contact Form', () => {
  it('sends each message to Tickets as a Ticket, in New', () => {
    const tabs = made('help-desk');
    const form = formOf('help-desk', 'Contact Form');
    const tickets = tabs.find((t) => t.name === 'Tickets')!;
    expect(form.destination).toEqual({ tabId: tickets.id, typeId: 'ticket', status: 'hd-new' });
    expect(form.sheet).toBeUndefined();
    expect(destinationProblem(form.destination, boardsOn(tickets), [ticket])).toBeNull();
  });

  it('is the Contact starter, named after its tab, its answers on the Ticket’s own fields', () => {
    const form = formOf('help-desk', 'Contact Form');
    expect(form.heading).toBe('Contact Form');
    expect(form.starter).toBe('contact');
    const goes = Object.fromEntries(questionsOf(form).map((q) => [q.prompt, q.goesTo]));
    expect(goes).toEqual({
      Name: { to: 'field', fieldId: 'f-customer' },
      Email: { to: 'field', fieldId: 'f-email' },
      Subject: { to: 'title' },
      Message: undefined,
    });
    expect(publishProblems(form, ticket)).toEqual([]);
  });

  it('starts unpublished, and reads back whole', () => {
    const form = formOf('help-desk', 'Contact Form');
    expect(form.closesAt).toBeUndefined();
    expect(form.limit).toBeUndefined();
    expect(readForm(JSON.parse(JSON.stringify(form)))).toEqual(form);
  });
});

describe('Event Planner’s RSVP', () => {
  it('sends each reply to RSVP Responses’ sheet as a row', () => {
    const tabs = made('event-planner');
    const form = tabs.find((t) => t.name === 'RSVP')!.form!;
    const responses = tabs.find((t) => t.name === 'RSVP Responses')!;
    const sheet = responses.elements.find((el) => el.type === 'shape' && el.shape === 'plan-sheet');
    const sheetId = sheet?.type === 'shape' ? sheet.planSheet?.sheetId : undefined;
    expect(sheetId).toBeTruthy();
    expect(form.sheet).toEqual({ tabId: responses.id, sheetId });
    expect(form.destination).toBeUndefined();
    expect(form.heading).toBe('RSVP');
    expect(form.starter).toBe('rsvp');
    expect(questionsOf(form).map((q) => q.prompt)).toEqual([
      'Name',
      'Email',
      'Attending?',
      'Dietary needs',
    ]);
  });

  it('keeps its Sheet’s id however often the tab is built', () => {
    const defs = planTemplateTabs('event-planner');
    const i = defs.findIndex((d) => d.name === 'RSVP Responses');
    const idOf = () => {
      const el = defs[i]!.build(0, 0)[0]!;
      return el.type === 'shape' ? el.planSheet?.sheetId : undefined;
    };
    expect(idOf()).toBe(idOf());
  });
});

describe('every template form', () => {
  const forms = PLAN_TEMPLATE_KINDS.flatMap((kind) =>
    PLAN_TEMPLATE_TABS[kind].flatMap((spec) => (spec.form ? [{ kind, spec }] : [])),
  );

  it('is Help Desk’s and Event Planner’s', () => {
    expect(forms.map((f) => `${f.kind} › ${f.spec.name}`)).toEqual([
      'event-planner › RSVP',
      'help-desk › Contact Form',
    ]);
  });

  it('names a tab of its template that holds a board or a Sheet', () => {
    for (const { kind, spec } of forms) {
      const to = PLAN_TEMPLATE_TABS[kind].find((t) => t.name === spec.form!.to);
      expect(!!(to?.board || to?.sheet), `${kind} › ${spec.name}`).toBe(true);
    }
  });

  it('brings no field of its own to a board’s card type, and is ready to publish', () => {
    for (const { kind, spec } of forms) {
      const to = PLAN_TEMPLATE_TABS[kind].find((t) => t.name === spec.form!.to)!;
      if (!to.board) continue;
      const type = boardResponseType(to.board)!;
      const starter = starterWithFields(formStarter(spec.form!.starter), spec.form!.fields);
      expect(buildStarter(starter, type, () => 'q-aaaaaa').type, spec.name).toBe(type);
      const form = formOf(kind, spec.name);
      expect(publishProblems(form, type), spec.name).toEqual([]);
      const board = boardSetup(to.board);
      expect(board.addTypes, spec.name).toContain(type.id);
      expect(board.columns[0]!.status, spec.name).toBe(form.destination!.status);
    }
  });
});

describe('templateForm', () => {
  const board: BoardSpec = {
    preset: 'blank',
    title: 'Queue',
    width: 1000,
    height: 600,
    setup: { columns: [{ id: 'q-new', name: 'New', status: 'q-new' }], addTypes: ['ticket'] },
  };

  it('goes nowhere when its target is missing, so the connect box asks', () => {
    const form = templateForm({ starter: 'contact', to: 'Gone' }, 'Contact', null);
    expect(form.destination).toBeUndefined();
    expect(form.sheet).toBeUndefined();
    expect(form.heading).toBe('Contact');
  });

  it('goes nowhere for a board that takes no card type', () => {
    const bare = { ...board, setup: { columns: board.setup!.columns! } };
    expect(boardResponseType(bare)).toBeUndefined();
    const form = templateForm({ starter: 'contact', to: 'Queue' }, 'Contact', {
      tabId: 't0',
      board: bare,
    });
    expect(form.destination).toBeUndefined();
  });

  it('goes to the board’s first column as its first card type', () => {
    const form = templateForm({ starter: 'contact', to: 'Queue' }, 'Contact', {
      tabId: 't0',
      board,
    });
    expect(form.destination).toEqual({ tabId: 't0', typeId: 'ticket', status: 'q-new' });
  });

  it('takes its ids from the random given', () => {
    let n = 0;
    const random = () => (n++ % 36) / 36;
    const form = templateForm({ starter: 'rsvp', to: 'x' }, 'RSVP', null, random);
    expect(form.sections[0]!.id).toBe('s-012345');
  });
});

describe('templateFormTarget', () => {
  const specs = [
    { name: 'Queue', board: { preset: 'blank', title: 'Queue', width: 1, height: 1 } as BoardSpec },
    { name: 'Rows' },
    { name: 'Form' },
  ];
  const sheetIds = [null, 'sheet-1', null];
  const ids = ['t0', 't1', 't2'];

  it('finds a board’s tab and a Sheet’s', () => {
    expect(templateFormTarget(specs, sheetIds, 'Queue', ids)).toEqual({
      tabId: 't0',
      board: specs[0]!.board,
    });
    expect(templateFormTarget(specs, sheetIds, 'Rows', ids)).toEqual({
      tabId: 't1',
      sheetId: 'sheet-1',
    });
  });

  it('finds nothing for a missing name, a tab of neither, or an id not given', () => {
    expect(templateFormTarget(specs, sheetIds, 'Gone', ids)).toBeNull();
    expect(templateFormTarget(specs, sheetIds, 'Form', ids)).toBeNull();
    expect(templateFormTarget(specs, sheetIds, 'Rows', ['t0'])).toBeNull();
  });
});

describe('starterWithFields', () => {
  it('leaves a starter as it is without renames', () => {
    const contact = formStarter('contact');
    expect(starterWithFields(contact, undefined)).toBe(contact);
  });

  it('renames only the fields named, keeping titles, descriptions and the rest', () => {
    const renamed = starterWithFields(formStarter('contact'), { 'Requested By': 'Customer' });
    const to = renamed.sections[0]!.questions.map((q) =>
      typeof q.to === 'object' ? q.to.label : q.to,
    );
    expect(to).toEqual(['Customer', 'Email', 'title', 'description']);
  });
});

describe('the agents’ path', () => {
  it('makes the Form tab with its form, naming the tab it feeds', () => {
    let n = 0;
    const tabs = buildTemplateTabs({ id: 'first', name: 'Tickets' }, 'help-desk', () => `id${++n}`);
    const form = tabs.find((t) => t.name === 'Contact Form');
    expect(form?.kind).toBe('form');
    expect(form?.elements).toEqual([]);
    expect(form?.form?.destination?.tabId).toBe('first');
  });
});
