// A form being changed by an agent (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"): the form,
// the card types as they will be saved, the boards and sheets it may send responses to, and the tabs to make or boards
// to change beside it, built up change by change and written only once every change has been checked. Where responses
// go and where each answer goes are decided here, as Responses Go To and Answer Goes To decide them.
import { newPlanSheetId, type Element, type Tab } from '@livediagram/document';
import {
  MAPPABLE_KINDS,
  QUESTION_TYPE_NAMES,
  canGoToTitle,
  destinationType,
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
  READY_MADE_CARD_TYPES,
  boardAddTypes,
  boardTakesType,
  newCustomFieldId,
  newItemTypeId,
  resolveType,
  type CustomFieldDef,
  type ItemTypeDef,
} from '@livediagram/items';
import {
  boardsOf,
  responsesBoardTab,
  responsesSheetTab,
  uniqueTypeLabel,
} from '@livediagram/templates';
import { refuse, resolveBoard, resolveColumn, resolveSheet, type FormRefusal } from './form-names';
import type { BoardRef, FormWorld, SheetRef } from './form-world';

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
  // The boards and sheets responses may go to: the document's and the ones this draft makes.
  boards: BoardRef[];
  sheets: SheetRef[];
  // Responses tabs to make after the Form tab, in order.
  newTabs: Tab[];
  // Existing boards that now take the form's card type, by element id, with every type they take.
  changedBoards: Map<string, BoardRef>;
  // What was done, a line a change, as the answer says it.
  lines: string[];
  // The Form tab's theme was changed (set_form theme): written with the form.
  themeChanged?: true;
  newId: (prefix: 'q' | 's') => string;
}

export function draftOf(
  world: FormWorld,
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>,
  form: FormDefinition,
  newId: (prefix: 'q' | 's') => string,
): FormDraft {
  return {
    world,
    formTab,
    form,
    types: [...world.types],
    typesChanged: false,
    boards: [...world.boards],
    sheets: [...world.sheets],
    newTabs: [],
    changedBoards: new Map(),
    lines: [],
    newId,
  };
}

export function saveType(d: FormDraft, type: ItemTypeDef): void {
  const at = d.types.findIndex((t) => t.id === type.id);
  d.types = at < 0 ? [...d.types, type] : d.types.map((t, i) => (i === at ? type : t));
  d.typesChanged = true;
}

// A new card type named `label` (the form's heading by default), as + New Card Type makes it.
function newFormType(d: FormDraft, label = uniqueTypeLabel(d.form.heading, d.types)): ItemTypeDef {
  const type: ItemTypeDef = {
    ...starterBaseType(formStarter('blank'), d.types, newItemTypeId(label, d.types)),
    label,
    newTitle: `New ${label.toLowerCase()}`,
  };
  saveType(d, type);
  d.lines.push(`made the card type "${label}"`);
  return type;
}

// A card type by name: the document's, else a ready-made one of that name brought in (Candidate, Bug...), else a new
// one of that name, so a document of its own can name the type its responses become.
function typeNamed(d: FormDraft, name: string): ItemTypeDef {
  const own = resolveType(name, d.types);
  if (own.ok) return own.type;
  const ready = resolveType(name, READY_MADE_CARD_TYPES);
  if (ready.ok) {
    saveType(d, ready.type);
    d.lines.push(`brought in the ready-made card type "${ready.type.label}"`);
    return ready.type;
  }
  return newFormType(d, name.trim().slice(0, 28));
}

const takes = (b: BoardRef, types: readonly ItemTypeDef[], id: string) =>
  boardTakesType({ addTypes: b.types ?? undefined }, types, id);

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
    let sheet: SheetRef;
    if (r.sheet) {
      const found = resolveSheet(d.sheets, r.sheet);
      if (!found.ok) return found;
      sheet = found.sheet;
    } else {
      const sheetId = newPlanSheetId();
      const tab = responsesSheetTab(d.form.heading, d.formTab as Tab, sheetId);
      // The tab holds the one Sheet element responsesSheetTab made.
      tab.elements = tab.elements.map(
        (el) =>
          ({
            ...el,
            planSheet: { ...(el as { planSheet: object }).planSheet, start: BLANK_SHEET_START },
          }) as Element,
      );
      d.newTabs.push(tab);
      sheet = { tabId: tab.id, sheetId, name: tab.name };
      d.sheets.push(sheet);
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
  let type = r.cardType ? typeNamed(d, r.cardType) : undefined;
  let board: BoardRef;
  let status: string;
  if (r.board) {
    const found = resolveBoard(d.boards, r.board);
    if (!found.ok) return found;
    board = found.board;
    type ??= own && takes(board, d.types, own.id) ? own : undefined;
    type ??= boardAddTypes({ addTypes: board.types ?? undefined }, d.types)[0] ?? newFormType(d);
    if (r.column) {
      const column = resolveColumn(board, r.column);
      if (!column.ok) return column;
      status = column.column.status;
    } else status = board.columns[0]!.status;
  } else {
    if (r.column)
      return refuse(
        'column_unknown',
        'A new board has the columns New, In Progress and Done: name a column of an existing board only.',
      );
    type ??= own ?? newFormType(d);
    const tab = responsesBoardTab(
      d.form.heading,
      d.formTab,
      d.world.statuses.map((s) => [s.status, s.name] as const),
    );
    // A responses board takes the form's card type alone, so it shows only responses.
    const made = boardsOf(tab)[0]!;
    // The tab holds the one board responsesBoardTab made.
    tab.elements = [
      { ...made.element, planBoard: { ...made.setup, addTypes: [type.id] } } as Element,
    ];
    d.newTabs.push(tab);
    board = {
      tabId: tab.id,
      tabName: tab.name,
      elementId: made.element.id,
      title: made.setup.title,
      types: [type.id],
      columns: made.setup.columns.map((c) => ({ status: c.status, name: c.name })),
    };
    d.boards.push(board);
    status = board.columns[0]!.status;
  }
  // A board that confines its card types takes the form's too.
  if (board.types && !board.types.includes(type.id)) {
    const taking = { ...board, types: [...board.types, type.id] };
    d.boards = d.boards.map((b) => (b.elementId === board.elementId ? taking : b));
    d.changedBoards.set(board.elementId, taking);
  }
  const { sheet: _sheet, ...rest } = d.form;
  d.form = { ...rest, destination: { tabId: board.tabId, typeId: type.id, status } };
  // The status was chosen from the board's own columns.
  const column = board.columns.find((c) => c.status === status)!.name;
  d.lines.push(`responses go to ${type.label} cards in ${column} on "${board.tabName}"`);
  return null;
}

// The field New Field makes for `q`: the kind its type makes, or, for a choice with "Other" (whose answer is no option
// of a choice field), the text kind that holds any answer. A choice or rating field is drawn on the card face, as a
// starter's are, so it reads at a glance on the board.
function newFieldOf(q: FormQuestion, id: string, label: string): CustomFieldDef {
  if (q.other) return { id, label, kind: MAPPABLE_KINDS[q.type][1]! };
  const field = newFieldFor(q, id, label);
  return ['choice', 'multichoice', 'rating'].includes(field.kind)
    ? { ...field, onCard: true }
    : field;
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
      `"${q.prompt}" offers "Other", whose answer is no option of the choice field "${field.label}": map it to a text field (a new name makes one), or to Description.`,
    );
  if (!field) {
    if ((type.custom?.length ?? 0) >= ITEM_TYPE_CUSTOM_MAX)
      return refuse(
        'fields_full',
        `${type.label} holds ${ITEM_TYPE_CUSTOM_MAX} custom fields already: map to one of them, or to Description.`,
      );
    const id = newCustomFieldId(where, [...type.fields, ...(type.custom ?? []).map((f) => f.id)]);
    field = newFieldOf(q, id, where.slice(0, 40));
    saveType(d, { ...type, fields: [...type.fields, id], custom: [...(type.custom ?? []), field] });
    d.lines.push(
      `added the ${field.kind} field "${field.label}" to ${type.label}${
        q.other ? ' (a text field: an "Other" answer is no option of a choice field)' : ''
      }${field.onCard ? ', shown on the card' : ''}`,
    );
  }
  d.form = setTarget(d.form, q.id, { to: 'field', fieldId: field.id });
  return syncChoiceField(d, q.id);
}

// A question mapped to a choice field keeps the field holding every option it offers (an option the question drops
// stays on the field: a card may hold it); one given "Other" while mapped so is refused, as its answer would not fit.
export function syncChoiceField(d: FormDraft, questionId: string): FormRefusal | null {
  const q = questionsOf(d.form).find((x) => x.id === questionId);
  const type = destinationType(d.form.destination, d.types);
  if (!q || q.goesTo?.to !== 'field' || !type) return null;
  const target = q.goesTo;
  const field = type.custom?.find((f) => f.id === target.fieldId);
  if (!field || (field.kind !== 'choice' && field.kind !== 'multichoice')) return null;
  if (q.other)
    return refuse(
      'field_does_not_fit',
      `"${q.prompt}" offers "Other", whose answer is no option of the choice field "${field.label}": map it to a text field, or to Description.`,
    );
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
  // The field now holds every option the question offers, and the question has no Other: it fits.
  saveType(d, { ...type, custom: type.custom!.map((f) => (f.id === field.id ? next : f)) });
  return null;
}
