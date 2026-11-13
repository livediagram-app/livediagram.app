// Create Form for a drafted form (docs/specs/030-forms/describe-a-form.md "The preview"; blueprint describe-a-form.md
// "Create Form's plan"): what it makes, worked out before anything is committed. Responses go to cards on a new or
// existing board (a new card type named after the form, the first Short Answer its Title and a field for each other
// question that would land in Description) or to rows on a new or existing sheet. Pure: useFormActions commits it in
// one step, as a starter's start is.
import type { Element, Tab } from '@liveplanner/project';
import {
  columnForType,
  formStarter,
  newFormPartId,
  starterBaseType,
  withQuestionFields,
  type FormDefinition,
  type FormDraft,
} from '@liveplanner/forms';
import { newItemTypeId, type ItemTypeDef } from '@liveplanner/items';
import {
  boardsOf,
  responsesBoardTab,
  responsesSheetTab,
  sheetsOf,
  uniqueTypeLabel,
  withBoardTaking,
} from './form-start';

// Where a drafted form's responses go: the preview's Responses Go To menu.
export type FormDraftTarget =
  | { to: 'new-board' }
  | { to: 'board'; tabId: string; elementId: string }
  | { to: 'new-sheet' }
  | { to: 'sheet'; tabId: string; sheetId: string };

export type FormDraftTargetOption = { id: string; name: string; target: FormDraftTarget };

const targetId = (t: FormDraftTarget): string =>
  t.to === 'board' ? `board:${t.elementId}` : t.to === 'sheet' ? `sheet:${t.sheetId}` : t.to;

/** The menu: a new board, each board the plan has (by tab, its board's title after the first), a new sheet, each
 *  sheet it has. The Form tab's own content is never one. */
export function formDraftTargets(tabs: readonly Tab[], formTabId: string): FormDraftTargetOption[] {
  const others = tabs.filter((t) => t.id !== formTabId);
  const option = (name: string, target: FormDraftTarget) => ({
    id: targetId(target),
    name,
    target,
  });
  return [
    option('Cards on a New Board', { to: 'new-board' }),
    ...others.flatMap((t) =>
      boardsOf(t).map((b, i) =>
        option(`Cards on ${i === 0 ? t.name : b.setup.title || `${t.name} ${i + 1}`}`, {
          to: 'board',
          tabId: t.id,
          elementId: b.element.id,
        }),
      ),
    ),
    option('Rows in a New Sheet', { to: 'new-sheet' }),
    ...sheetsOf(others).map((s) =>
      option(`Rows in ${s.name}`, { to: 'sheet', tabId: s.tabId, sheetId: s.sheetId }),
    ),
  ];
}

/** The option first selected: where the Form tab's form already sends responses, else the draft's own choice. */
export function firstFormDraftTarget(
  options: readonly FormDraftTargetOption[],
  draft: Pick<FormDraft, 'respondsTo'>,
  current?: Pick<FormDefinition, 'destination' | 'sheet'>,
): FormDraftTargetOption {
  const at = (id: string) => options.find((o) => o.id === id);
  if (current?.sheet) {
    const found = at(`sheet:${current.sheet.sheetId}`);
    if (found) return found;
  }
  if (current?.destination) {
    const found = options.find(
      (o) => o.target.to === 'board' && o.target.tabId === current.destination!.tabId,
    );
    if (found) return found;
  }
  return at(draft.respondsTo === 'sheet' ? 'new-sheet' : 'new-board')!;
}

export type FormDraftPlan = {
  form: FormDefinition;
  // The new card type responses are made as (to a board); null for a sheet.
  type: ItemTypeDef | null;
  // A Board or Sheet tab made for the responses, placed after the Form tab.
  newTab: Tab | null;
  // An existing Board tab whose board now takes the new type.
  changedTab: Tab | null;
  // A new sheet to make as its tab is.
  newSheet: { tabId: string; sheetId: string; title: string } | null;
};

// The form with fresh ids for its sections and questions, so none is the draft's s-1 or q-1.
function withFreshIds(form: FormDefinition, random: () => number): FormDefinition {
  return {
    ...form,
    sections: form.sections.map((s) => ({
      ...s,
      id: newFormPartId('s', random),
      questions: s.questions.map((q) => ({ ...q, id: newFormPartId('q', random) })),
    })),
  };
}

export function planFormDraft(input: {
  draft: FormDraft;
  target: FormDraftTarget;
  formTab: Tab;
  tabs: readonly Tab[];
  types: readonly ItemTypeDef[];
  statusNames: Iterable<readonly [string, string]>;
  newSheetId: () => string;
  // The form's name when the tab gives it one of its own.
  heading?: string;
  random?: () => number;
}): FormDraftPlan {
  const { draft, formTab, tabs, types } = input;
  const random = input.random ?? Math.random;
  const base: FormDefinition = {
    ...withFreshIds(draft.form, random),
    ...(input.heading ? { heading: input.heading } : {}),
  };
  const target = input.target;

  if (target.to === 'new-sheet' || target.to === 'sheet') {
    const existing =
      target.to === 'sheet'
        ? sheetsOf(tabs).find((s) => s.tabId === target.tabId && s.sheetId === target.sheetId)
        : undefined;
    if (existing)
      return {
        form: { ...base, sheet: { tabId: existing.tabId, sheetId: existing.sheetId } },
        type: null,
        newTab: null,
        changedTab: null,
        newSheet: null,
      };
    const sheetId = input.newSheetId();
    const tab = responsesSheetTab(base.heading, formTab, sheetId);
    return {
      form: { ...base, sheet: { tabId: tab.id, sheetId } },
      type: null,
      newTab: tab,
      changedTab: null,
      newSheet: { tabId: tab.id, sheetId, title: tab.name },
    };
  }

  // A new card type named after the form, as Responses Go To's New Card Type makes one.
  const label = uniqueTypeLabel(base.heading, types);
  const blank: ItemTypeDef = {
    ...starterBaseType(formStarter('blank'), types, newItemTypeId(label, types)),
    label,
    newTitle: `New ${label.toLowerCase()}`,
  };
  // The first Short Answer is the card's Title; each other question that would land in Description gets a field.
  let titled = false;
  const named: FormDefinition = {
    ...base,
    sections: base.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => {
        if (titled || q.type !== 'short') return q;
        titled = true;
        return { ...q, goesTo: { to: 'title' as const } };
      }),
    })),
  };
  const fielded = withQuestionFields(named, blank);
  const type = fielded?.type ?? blank;
  const form = fielded?.form ?? named;

  const board =
    target.to === 'board'
      ? tabs.flatMap((t) =>
          t.id === target.tabId
            ? boardsOf(t)
                .filter((b) => b.element.id === target.elementId)
                .map((b) => ({ tab: t, ...b }))
            : [],
        )[0]
      : undefined;
  if (board) {
    const changed = withBoardTaking(board.tab, type.id);
    const status =
      columnForType(board.setup.columns, type, undefined) ?? board.setup.columns[0]!.status;
    return {
      form: { ...form, destination: { tabId: board.tab.id, typeId: type.id, status } },
      type,
      newTab: null,
      changedTab: changed === board.tab ? null : changed,
      newSheet: null,
    };
  }
  // A new board (or the one chosen, gone since): "<Form> Responses", taking the new type alone.
  const tab = responsesBoardTab(base.heading, formTab, input.statusNames, undefined, random, {
    typeId: type.id,
  });
  const made = boardsOf(tab)[0]!;
  tab.elements = [
    { ...made.element, planBoard: { ...made.setup, addTypes: [type.id] } } as Element,
  ];
  return {
    form: {
      ...form,
      destination: { tabId: tab.id, typeId: type.id, status: made.setup.columns[0]!.status },
    },
    type,
    newTab: tab,
    changedTab: null,
    newSheet: null,
  };
}
