// Starting a form (docs/specs/030-forms/forms.md "Starting a form"): what a starter makes, worked out before anything
// is committed. A starter whose responses are cards goes to the document's first Board tab whose board takes its card
// type, else a new Board tab after the Form tab (the card type the starter's ready-made one or a new one named after
// the form, with the fields its questions map to); one whose responses are rows goes to a new Sheet tab after it; a
// Blank form goes nowhere until one is chosen (its connect box). Pure: useFormActions commits it.
import {
  SHAPE_DEFAULT_SIZE,
  createShape,
  isDefaultTabName,
  type Element,
  type Tab,
} from '@livediagram/document';
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
  // A Sheet tab made for the responses (a row each), and its sheet, to be made as the tab is.
  newSheet: { tab: Tab; sheetId: string; title: string } | null;
};

// The Sheet tab a form's responses go to (New Sheet, a sheet starter): "<Form> Responses" after the Form tab, in its
// theme, holding one blank sheet.
export function responsesSheetTab(heading: string, formTab: Tab, sheetId: string): Tab {
  return {
    id: crypto.randomUUID(),
    name: `${heading} Responses`.slice(0, 80),
    elements: [{ ...createShape('plan-sheet', 0, 0), planSheet: { sheetId } }],
    defaultTextSize: 'sm',
    kind: 'sheet',
    opensIn: 'plan',
    ...(formTab.theme ? { theme: formTab.theme } : {}),
  };
}

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
  // A new sheet's id, for a starter whose responses are rows.
  newSheetId?: () => string;
  // The form's name when the tab gives it one (its own name), so a Responses tab is named after it.
  heading?: string;
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
  const form: FormDefinition = {
    ...built,
    v: FORM_VERSION,
    ...(input.heading ? { heading: input.heading } : {}),
  };
  // The catalogue's own type, untouched, needs no write; a ready-made type it lacks, a new one or one given fields do.
  const saveType = !types.includes(type);

  // Rows in a sheet: a new Sheet tab, no card type to write.
  if (!input.board && starter.respondsTo === 'sheet' && input.newSheetId) {
    const sheetId = input.newSheetId();
    const tab = responsesSheetTab(form.heading, formTab, sheetId);
    return {
      form: { ...form, sheet: { tabId: tab.id, sheetId } },
      type,
      saveType: false,
      newBoardTab: null,
      newSheet: { tab, sheetId, title: tab.name },
    };
  }
  // Nowhere yet (Blank): its connect box asks, and nothing is made that might not be wanted.
  if (!input.board && starter.respondsTo !== 'board')
    return { form, type, saveType: false, newBoardTab: null, newSheet: null };

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
    newSheet: null,
  };
}

// A responses board still on its automatic name takes the card type's (docs/specs/030-forms/forms.md "Responses Go To
// and Settings"): a default tab name, "<Form> Responses", or the previous type's "<Type> Responses" becomes
// "<Type> Responses", on the tab and on its board's title where that matched. A name someone gave it is kept.
export function withAutoBoardName(
  tab: Tab,
  names: { heading: string; from?: string | undefined; to: string },
): Tab {
  const was = tab.name;
  const auto =
    isDefaultTabName(was) ||
    was === `${names.heading} Responses` ||
    (!!names.from && was === `${names.from} Responses`);
  const name = `${names.to} Responses`.slice(0, 80);
  if (!auto || name === was) return tab;
  return {
    ...tab,
    name,
    elements: tab.elements.map((el) =>
      el.type === 'shape' && el.shape === 'plan-board' && el.planBoard?.title === was
        ? { ...el, planBoard: { ...el.planBoard, title: name } }
        : el,
    ),
  };
}

// The document's sheets a form can send its responses to (docs/specs/030-forms/forms.md "Responses to a Sheet"): each
// Sheet tab's sheets, named after the tab ("Budget", or "Budget 2" for a second sheet on it).
export function sheetsOf(tabs: readonly Tab[]): { tabId: string; sheetId: string; name: string }[] {
  return tabs.flatMap((t) => {
    if (t.kind !== 'sheet') return [];
    const ids = t.elements.flatMap((el) =>
      el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet
        ? [el.planSheet.sheetId]
        : [],
    );
    return ids.map((sheetId, i) => ({
      tabId: t.id,
      sheetId,
      name: i === 0 ? t.name : `${t.name} ${i + 1}`,
    }));
  });
}
