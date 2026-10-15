// A form being changed by an agent (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"): the form,
// the card types as they will be saved, and the tabs to make or change beside it, built up change by change and
// written only once every change has been checked. Where responses go and where each answer goes are decided here,
// as Responses Go To and Answer Goes To decide them.
import { newPlanSheetId, type Element, type Tab } from '@livediagram/document';
import {
  MAPPABLE_KINDS,
  NEW_FIELD_KIND,
  QUESTION_TYPE_NAMES,
  canGoToTitle,
  destinationType,
  fieldTakes,
  formStarter,
  newFieldFor,
  questionsOf,
  setTarget,
  starterBaseType,
  type FormDefinition,
  type FormQuestion,
} from '@livediagram/forms';
import {
  ITEM_TYPE_CUSTOM_MAX,
  boardAddTypes,
  boardTakesType,
  newCustomFieldId,
  newItemTypeId,
  resolveType,
  type ItemTypeDef,
} from '@livediagram/items';
import {
  boardsOf,
  responsesBoardTab,
  responsesSheetTab,
  uniqueTypeLabel,
  withBoardTaking,
} from '@livediagram/templates';
import {
  refuse,
  resolveBoard,
  resolveColumn,
  resolveSheet,
  type FormRefusal,
  type Named,
} from './form-names';
import type { FormWorld, WorldTab } from './form-world';

export interface RespondsToInput {
  to: 'board' | 'sheet';
  board?: string;
  cardType?: string;
  column?: string;
  sheet?: string;
}

// The template mark that has the api make a new Sheet tab's sheet as the tab is written.
const BLANK_SHEET_START = 'blank-spreadsheet';

export interface FormDraft {
  world: FormWorld;
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>;
  form: FormDefinition;
  types: ItemTypeDef[];
  typesChanged: boolean;
  // Responses tabs to make after the Form tab, in order.
  newTabs: Tab[];
  // Existing Board tabs whose board now takes the form's card type.
  changedTabs: Map<string, WorldTab>;
  // What was done, a line a change, as the answer says it.
  lines: string[];
  newId: (prefix: 'q' | 's') => string;
}

// Every tab the draft knows: the document's (as changed) and the ones it will make.
export function draftTabs(d: FormDraft): Tab[] {
  return [...d.world.tabs.map((t) => d.changedTabs.get(t.id) ?? t), ...d.newTabs];
}

function saveType(d: FormDraft, type: ItemTypeDef): void {
  const at = d.types.findIndex((t) => t.id === type.id);
  d.types = at < 0 ? [...d.types, type] : d.types.map((t, i) => (i === at ? type : t));
  d.typesChanged = true;
}

// A new card type named after the form, as + New Card Type makes it.
function newFormType(d: FormDraft): ItemTypeDef {
  const label = uniqueTypeLabel(d.form.heading, d.types);
  const type: ItemTypeDef = {
    ...starterBaseType(formStarter('blank'), d.types, newItemTypeId(label, d.types)),
    label,
    newTitle: `New ${label.toLowerCase()}`,
  };
  saveType(d, type);
  return type;
}

function namedType(d: FormDraft, name: string): Named<{ type: ItemTypeDef }> {
  const found = resolveType(name, d.types);
  return found.ok ? found : refuse(found.code, found.message);
}

// Responses to a board or a sheet, named or new (Responses Go To). A board form's type is the one named, else
// `prefer` (a starter's), else the form's own (its destination's), else the board's first, else a new one named after
// the form.
export function setRespondsTo(
  d: FormDraft,
  r: RespondsToInput,
  prefer?: ItemTypeDef,
): FormRefusal | null {
  if (r.to === 'sheet') {
    if (r.board || r.cardType || r.column)
      return refuse(
        'responds_to_mixed',
        'A sheet takes no board, card type or column: name a sheet, or none for a new one.',
      );
    let sheet: { tabId: string; sheetId: string; name: string };
    if (r.sheet) {
      const found = resolveSheet(draftTabs(d), r.sheet);
      if (!found.ok) return found;
      sheet = found.sheet;
    } else {
      const sheetId = newPlanSheetId();
      const tab = responsesSheetTab(
        d.form.heading,
        { ...d.formTab, id: d.formTab.id } as Tab,
        sheetId,
      );
      tab.elements = tab.elements.map((el) =>
        el.type === 'shape' && el.planSheet
          ? ({ ...el, planSheet: { ...el.planSheet, start: BLANK_SHEET_START } } as Element)
          : el,
      );
      d.newTabs.push(tab);
      sheet = { tabId: tab.id, sheetId, name: tab.name };
    }
    // Switching keeps the board settings, for switching back.
    d.form = { ...d.form, sheet: { tabId: sheet.tabId, sheetId: sheet.sheetId } };
    d.lines.push(`responses go to the sheet "${sheet.name}", a row each`);
    return null;
  }
  if (r.sheet)
    return refuse(
      'responds_to_mixed',
      'A board takes no sheet: name a board, or none for a new one.',
    );
  const own = prefer ?? destinationType(d.form.destination, d.types);
  let type: ItemTypeDef | undefined;
  if (r.cardType) {
    const found = namedType(d, r.cardType);
    if (!found.ok) return found;
    type = found.type;
  }
  let tab: Tab;
  let elementId: string;
  let status: string;
  if (r.board) {
    const found = resolveBoard(draftTabs(d) as WorldTab[], r.board);
    if (!found.ok) return found;
    const { board } = found;
    type ??= own && boardTakesType(board.setup, d.types, own.id) ? own : undefined;
    type ??= boardAddTypes(board.setup, d.types)[0] ?? newFormType(d);
    tab = board.tab;
    elementId = board.elementId;
    if (r.column) {
      const column = resolveColumn(board.setup, r.column);
      if (!column.ok) return column;
      status = column.column.status;
    } else status = board.setup.columns[0]!.status;
  } else {
    if (r.column)
      return refuse(
        'column_unknown',
        'A new board has the columns New, In Progress and Done: name a column of an existing board only.',
      );
    type ??= own ?? newFormType(d);
    tab = responsesBoardTab(
      d.form.heading,
      d.formTab,
      d.world.statuses.map((s) => [s.status, s.name] as const),
    );
    d.newTabs.push(tab);
    const made = boardsOf(tab)[0]!;
    elementId = made.element.id;
    status = made.setup.columns[0]!.status;
  }
  // A board that confines its card types takes the form's too.
  const taking = withBoardTaking(tab, type.id);
  if (taking !== tab) {
    const at = d.newTabs.indexOf(tab);
    if (at >= 0) d.newTabs[at] = taking;
    else d.changedTabs.set(tab.id, taking as WorldTab);
  }
  const { sheet: _sheet, ...rest } = d.form;
  d.form = { ...rest, destination: { tabId: tab.id, typeId: type.id, status } };
  const column = boardsOf(taking)
    .find((b) => b.element.id === elementId)
    ?.setup.columns.find((c) => c.status === status);
  d.lines.push(`responses go to ${type.label} cards in ${column?.name ?? status} on "${tab.name}"`);
  return null;
}

// Where `q`'s answer goes: Title, Description, or a field of the form's card type by name, made (New Field) when
// the type lacks it. A choice field mapped keeps the question's options (it gains any it lacks).
export function setGoesTo(d: FormDraft, q: FormQuestion, goesTo: string): FormRefusal | null {
  const where = goesTo.trim();
  if (/^description$/i.test(where)) {
    d.form = setTarget(d.form, q.id, { to: 'description' });
    return null;
  }
  if (d.form.sheet)
    return refuse(
      'goes_to_on_sheet',
      'This form’s responses are rows in a sheet: each answer has its own column, so goesTo is for board forms.',
    );
  if (/^title$/i.test(where)) {
    if (!canGoToTitle(q))
      return refuse(
        'title_not_allowed',
        `A ${QUESTION_TYPE_NAMES[q.type]} answer cannot be a card's title. Title takes Short Answer, Email, Number, Single Choice or Date.`,
      );
    d.form = setTarget(d.form, q.id, { to: 'title' });
    return null;
  }
  const type = destinationType(d.form.destination, d.types);
  if (!type)
    return refuse(
      'goes_to_needs_board',
      'Responses go nowhere yet: set respondsTo to a board before mapping answers to card fields.',
    );
  let field = type.custom?.find((f) => f.label.trim().toLowerCase() === where.toLowerCase());
  if (field && !MAPPABLE_KINDS[q.type].includes(field.kind))
    return refuse(
      'field_does_not_fit',
      `The ${type.label} field "${field.label}" is ${field.kind}; a ${QUESTION_TYPE_NAMES[q.type]} answer goes to ${MAPPABLE_KINDS[q.type].join(' or ')} fields. Name another field, or a new name for a new one.`,
    );
  if (field && q.other && (field.kind === 'choice' || field.kind === 'multichoice'))
    return refuse(
      'field_does_not_fit',
      'An "Other" answer is no option of a choice field: map it to a text field, or to Description.',
    );
  if (!field) {
    if ((type.custom?.length ?? 0) >= ITEM_TYPE_CUSTOM_MAX)
      return refuse(
        'fields_full',
        `${type.label} holds ${ITEM_TYPE_CUSTOM_MAX} custom fields already: map to one of them, or to Description.`,
      );
    const id = newCustomFieldId(where, [...type.fields, ...(type.custom ?? []).map((f) => f.id)]);
    field = newFieldFor(q, id, where.slice(0, 40));
    saveType(d, { ...type, fields: [...type.fields, id], custom: [...(type.custom ?? []), field] });
    d.lines.push(`added the ${NEW_FIELD_KIND[q.type]} field "${field.label}" to ${type.label}`);
  }
  d.form = setTarget(d.form, q.id, { to: 'field', fieldId: field.id });
  return syncChoiceField(d, q.id);
}

// A question mapped to a choice field keeps the field holding every option it offers (an option the question
// drops stays on the field: a card may hold it).
export function syncChoiceField(d: FormDraft, questionId: string): FormRefusal | null {
  const q = questionsOf(d.form).find((x) => x.id === questionId);
  const type = destinationType(d.form.destination, d.types);
  if (!q || q.goesTo?.to !== 'field' || !type) return null;
  const target = q.goesTo;
  const field = type.custom?.find((f) => f.id === target.fieldId);
  if (!field || (field.kind !== 'choice' && field.kind !== 'multichoice')) return null;
  const has = field.options ?? [];
  const missing = (q.options ?? []).filter(
    (o) => !has.some((h) => h.toLowerCase() === o.toLowerCase()),
  );
  if (!missing.length) return null;
  if (has.length + missing.length > 20)
    return refuse(
      'field_options_full',
      `The field "${field.label}" would offer more than 20 options: map "${q.prompt}" elsewhere.`,
    );
  const next = { ...field, options: [...has, ...missing] };
  saveType(d, { ...type, custom: type.custom!.map((f) => (f.id === field.id ? next : f)) });
  if (!fieldTakes(q, next))
    return refuse('field_does_not_fit', `"${q.prompt}" no longer fits the field "${field.label}".`);
  return null;
}
