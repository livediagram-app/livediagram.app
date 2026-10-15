// Starting a form (docs/specs/030-forms/forms.md "Starting a form"): what a starter makes, worked out before anything
// is committed. The destination is the document's first Board tab whose board takes the starter's card type, else a
// new Board tab after the Form tab; the card type is the starter's ready-made one or a new one named after the form,
// with the fields its questions map to. Pure: useFormActions commits it.
import { SHAPE_DEFAULT_SIZE, createShape, type Element, type Tab } from '@livediagram/document';
import {
  FORM_VERSION,
  buildStarter,
  formStarter,
  newFormPartId,
  starterBaseType,
  type FormDefinition,
  type FormStarter,
} from '@livediagram/forms';
import {
  boardAddTypes,
  boardTakesType,
  freshBoardSetup,
  newItemTypeId,
  planBoardHeightFor,
  planBoardWidthFor,
  statusColumn,
  type ItemTypeDef,
  type PlanBoardSetup,
  type PlanColumn,
} from '@livediagram/items';

export type FormStartPlan = {
  form: FormDefinition;
  // The card type responses are made as, with the fields the starter maps to; `saveType` when the catalogue needs it
  // written (new, or fields added).
  type: ItemTypeDef;
  saveType: boolean;
  // A Board tab made for the responses, when no board of the document took the type.
  newBoardTab: Tab | null;
};

// The live boards of a tab, in order (none for a tab that is no Board tab, or not loaded).
export function boardsOf(tab: Tab): { element: Element; setup: PlanBoardSetup }[] {
  if (tab.kind !== 'board') return [];
  const out: { element: Element; setup: PlanBoardSetup }[] = [];
  for (const el of tab.elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard) continue;
    if (el.planBoard.archive || el.planBoard.allCards || el.planBoard.columns.length === 0)
      continue;
    out.push({ element: el, setup: el.planBoard });
  }
  return out;
}

// The board a response board of a starter is made from: a bug report's triage board, else New, In Progress, Done.
export function responsesBoardSetup(
  starter: FormStarter,
  title: string,
  existing: Iterable<readonly [string, string]>,
  random: () => number = Math.random,
): PlanBoardSetup {
  if (starter.readyType === 'bug')
    return { ...freshBoardSetup('bug-triage', random, existing), title };
  // Kanban's set-up, kept to the three columns a response passes through.
  const kanban = freshBoardSetup('kanban', random, existing);
  const column = (name: string) => kanban.columns.find((c) => c.name === name)!;
  const strip = ({ wipLimit: _w, ...c }: PlanColumn): PlanColumn => c;
  return {
    ...kanban,
    title,
    columns: [
      { ...statusColumn('new', 'New'), status: newStatusOf(existing, 'New', random) },
      strip(column('In Progress')),
      strip(column('Done')),
    ],
    doneColumnId: column('Done').id,
  };
}

// A status for `name`: the document's own when it has one of that name, else a new id.
function newStatusOf(
  existing: Iterable<readonly [string, string]>,
  name: string,
  random: () => number,
) {
  for (const [status, n] of existing)
    if (n.trim().toLowerCase() === name.toLowerCase()) return status;
  const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
  return `${name.toLowerCase().replace(/\s+/g, '-')}~${suffix}`;
}

// A new Board tab for a form's responses: "<Form> Responses", New, In Progress and Done, in the Form tab's theme.
export function responsesBoardTab(
  heading: string,
  formTab: Pick<Tab, 'theme'>,
  statusNames: Iterable<readonly [string, string]>,
  starter: FormStarter = formStarter('blank'),
  random: () => number = Math.random,
): Tab {
  const title = `${heading} Responses`.slice(0, 80);
  const setup = responsesBoardSetup(starter, title, statusNames, random);
  const element = {
    ...createShape('plan-board', 0, 0),
    planBoard: setup,
    width: Math.max(SHAPE_DEFAULT_SIZE['plan-board'].width, planBoardWidthFor(setup)),
    height: planBoardHeightFor(setup),
  } as Element;
  return {
    id: crypto.randomUUID(),
    name: title,
    elements: [element],
    defaultTextSize: 'sm',
    kind: 'board',
    opensIn: 'plan',
    ...(formTab.theme ? { theme: formTab.theme } : {}),
  };
}

// A type's name for a form, unique in the catalogue ignoring case ("Feedback", "Feedback 2").
export function uniqueTypeLabel(heading: string, types: readonly ItemTypeDef[]): string {
  const base = heading.trim().slice(0, 28) || 'Response';
  const taken = new Set(types.map((t) => t.label.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

// `tab` with each board that confines its card types also taking `typeId` (a board taking every type is untouched).
export function withBoardTaking(tab: Tab, typeId: string): Tab {
  let changed = false;
  const elements = tab.elements.map((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard?.addTypes) return el;
    if (el.planBoard.addTypes.includes(typeId)) return el;
    changed = true;
    return { ...el, planBoard: { ...el.planBoard, addTypes: [...el.planBoard.addTypes, typeId] } };
  });
  return changed ? { ...tab, elements } : tab;
}

export function planFormStart(input: {
  starter: FormStarter;
  formTab: Tab;
  tabs: readonly Tab[];
  types: readonly ItemTypeDef[];
  statusNames: Iterable<readonly [string, string]>;
  random?: () => number;
  // The board responses go to (a form made from a board's cog), in place of the first that fits.
  board?: { tabId: string; elementId: string };
}): FormStartPlan {
  const { starter, formTab, tabs, types } = input;
  const random = input.random ?? Math.random;
  const newId = (prefix: 'q' | 's') => newFormPartId(prefix, random);
  const boards = tabs
    .flatMap((t) => (t.id === formTab.id ? [] : boardsOf(t).map((b) => ({ tab: t, ...b }))))
    .filter(
      (b) =>
        !input.board || (b.tab.id === input.board.tabId && b.element.id === input.board.elementId),
    );
  // A blank form takes the first board's first card type, when there is one.
  const blankType =
    starter.id === 'blank' ? boards.flatMap((b) => boardAddTypes(b.setup, types))[0] : undefined;
  const baseType = blankType ?? starterBaseType(starter, types, newItemTypeId(starter.name, types));
  const withBase = types.some((t) => t.id === baseType.id) ? types : [...types, baseType];
  const target = boards.find((b) => boardTakesType(b.setup, withBase, baseType.id));
  const { form: built, type } = buildStarter(starter, baseType, newId);
  const form: FormDefinition = { ...built, v: FORM_VERSION };
  // The catalogue's own type, untouched, needs no write; a ready-made type it lacks, a new one or one given fields do.
  const saveType = !types.includes(type);

  let newBoardTab: Tab | null = null;
  let tabId: string;
  let status: string;
  if (target) {
    tabId = target.tab.id;
    status = target.setup.columns[0]!.status;
  } else {
    newBoardTab = responsesBoardTab(form.heading, formTab, input.statusNames, starter, random);
    tabId = newBoardTab.id;
    status = boardsOf(newBoardTab)[0]!.setup.columns[0]!.status;
  }
  return {
    form: { ...form, destination: { tabId, typeId: type.id, status } },
    type,
    saveType,
    newBoardTab,
  };
}
