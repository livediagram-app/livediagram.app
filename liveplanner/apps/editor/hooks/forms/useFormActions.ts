'use client';

// The Form tab's editor actions (docs/specs/030-forms/forms.md "Starting a form", "Building a form"): a starter made
// into a Form tab (and a Board tab for its responses when the project has none that fits), each builder edit as one
// tab change and one undo step, and the card type changes a mapping needs. A locked tab refuses every change, as
// every edit there is.
import { useCallback, useMemo } from 'react';
import {
  formStarter,
  starterBaseType,
  newFieldFor,
  newFieldLabel,
  readForm,
  withQuestionFields,
  UNTITLED_FORM,
  type FormDefinition,
  type FormDraft,
  type FormQuestion,
  type StarterId,
} from '@liveplanner/forms';
import { isDefaultTabName, newPlanSheetId, type Tab } from '@liveplanner/project';
import { placeNewSheet } from '@/lib/sheet-seeds';
import { newCustomFieldId, newItemTypeId, type ItemTypeDef } from '@liveplanner/items';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  useFormDestinationActions,
  type FormDestinationActions,
} from './useFormDestinationActions';
import {
  boardsOf,
  planFormDraft,
  planFormStart,
  type FormDraftTarget,
  responsesBoardTab,
  responsesSheetTab,
  uniqueTypeLabel,
  withAutoBoardName,
  withBoardTaking,
} from '@liveplanner/templates';

export type FormActions = FormDestinationActions & {
  // A starter chosen on Start Planning: the tab becomes a Form tab holding it.
  startForm: (starter: StarterId) => void;
  // Describe a Form's Create Form (docs/specs/030-forms/describe-a-form.md "The preview"): the tab becomes (or stays) a
  // Form tab holding the drafted form, its responses going where `target` says, in one undo step. Optional only so a
  // test's stand-in actions need not name it; the hook always gives it.
  startDraftedForm?: (draft: FormDraft, target: FormDraftTarget) => void;
  // New Form on a board's cog: a Blank form on a new Form tab after the board's, its responses going to that board,
  // opened.
  newFormFor: (boardElementId: string) => void;
  // One builder edit to the active Form tab's form; `kind` names it for telemetry where it is counted.
  changeForm: (change: (form: FormDefinition) => FormDefinition) => void;
  // The same with no undo step, for what the Forms tour adds and takes away itself (its example question), which Undo
  // must never bring back (docs/specs/030-forms/forms.md "The Forms tour").
  changeFormQuietly: (change: (form: FormDefinition) => FormDefinition) => void;
  // The heading, which is the tab's name too: both in one step, and the board or sheet its responses go to follows
  // while it is still on its automatic name ("<Form> Responses").
  renameForm: (name: string) => void;
  // New Field "<Prompt>": a custom field of the question's kind on the destination's card type; answers its id.
  addFieldFor: (question: FormQuestion, type: ItemTypeDef) => string | null;
  // A choice question's options changed: the field it maps to follows (one catalogue change).
  syncFieldOptions: (type: ItemTypeDef, fieldId: string, options: readonly string[]) => void;
  // Responses Go To's New Board: a Board tab after this one, "<Form> Responses", its New column the destination.
  newResponsesBoard: () => void;
  // Responses Go To's New Card Type: a type named after the form, taken by the destination's board, now the type,
  // made with a field for each question whose answer would otherwise go to Description, each mapped to it.
  newCardType: () => void;
  // Responses Go To's Board or Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): to a Sheet, the given one
  // (or the project's first); to a Board, the sheet let go (the board destination was kept).
  setResponsesTo: (
    to: { kind: 'board' } | { kind: 'sheet'; tabId: string; sheetId: string },
  ) => void;
  // New Sheet: a Sheet tab "<Form> Responses" after this one, a blank sheet on it the destination, made at once (the
  // form stays open), or opened so the sheet is made where nothing can make it.
  newResponsesSheet: () => void;
};

const blankForm = (name: string): FormDefinition => ({
  v: 1,
  heading: isDefaultTabName(name) ? UNTITLED_FORM : name,
  sections: [{ id: 's-1', title: '', questions: [] }],
});

export function useFormActions({
  activeId,
  tabs,
  commitTabs: commitAnyTabs,
  tickTabs,
  itemTypes,
  statusNames,
  markTabLoaded,
  openTab,
  makeSheet,
  retitleSheets,
}: {
  activeId: string;
  tabs: readonly Tab[];
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // A change to the tabs with no undo step (changeFormQuietly).
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
  itemTypes: Pick<ItemTypesSlice, 'types' | 'saveType'>;
  statusNames: ReadonlyMap<string, string>;
  markTabLoaded?: (tabId: string) => void;
  // Opens a tab (the Form tab New Form makes).
  openTab?: (tabId: string) => void;
  // Makes a sheet on a tab just added, without opening it (a sheet starter's responses sheet).
  makeSheet?: (create: { id: string; tabId: string; title: string }) => void;
  // Renames sheets still titled `from` (a Sheet tab renamed, as useTabActions does).
  retitleSheets?: (sheetIds: readonly string[], from: string, to: string) => void;
}): FormActions {
  // Read when used, so the actions keep one identity while tabs and types change underneath.
  const live = useLatest({
    tabs,
    itemTypes,
    statusNames,
    markTabLoaded,
    openTab,
    makeSheet,
    retitleSheets,
    commitAnyTabs,
  });
  const commitTabs = useCallback(
    (map: (ts: Tab[]) => Tab[]) =>
      commitAnyTabs((ts) => (ts.find((t) => t.id === activeId)?.locked ? ts : map(ts))),
    [commitAnyTabs, activeId],
  );

  const startForm = useCallback<FormActions['startForm']>(
    (starterId) => {
      const { tabs: now, itemTypes: slice, statusNames: names } = live.current;
      const formTab = now.find((t) => t.id === activeId);
      if (!formTab || formTab.locked) return;
      const starter = formStarter(starterId);
      // A tab with a name of its own gives it to the form (docs/specs/030-forms/forms.md "The Form tab"), and its
      // Responses tab is named after that.
      const own = isDefaultTabName(formTab.name) ? undefined : formTab.name;
      const plan = planFormStart({
        starter,
        formTab,
        tabs: now,
        types: slice.types,
        statusNames: [...names],
        ...(own ? { heading: own } : {}),
        ...(live.current.makeSheet ? { newSheetId: newPlanSheetId } : {}),
      });
      const name = plan.form.heading;
      const form = plan.form;
      commitTabs((ts) => {
        const next = ts.map((t) =>
          t.id === activeId
            ? {
                ...t,
                name,
                kind: 'form' as const,
                form,
                dashboard: undefined,
              }
            : t,
        );
        const made = plan.newBoardTab ?? plan.newSheet?.tab;
        if (!made) return next;
        const at = next.findIndex((t) => t.id === activeId);
        next.splice(at + 1, 0, made);
        return next;
      });
      if (plan.newBoardTab) live.current.markTabLoaded?.(plan.newBoardTab.id);
      if (plan.newSheet) {
        const { tab, sheetId, title } = plan.newSheet;
        live.current.markTabLoaded?.(tab.id);
        // Made now, so responses have a sheet before anyone opens its tab.
        live.current.makeSheet?.({ id: sheetId, tabId: tab.id, title });
      }
      // The card type is a catalogue change of its own: it stays after an undo, as a template's types do.
      if (plan.saveType) slice.saveType(plan.type);
      track('Form', 'Created', starter.telemetry);
    },
    [activeId, commitTabs, live],
  );

  const startDraftedForm = useCallback<NonNullable<FormActions['startDraftedForm']>>(
    (draft, target) => {
      const { tabs: now, itemTypes: slice, statusNames: names } = live.current;
      const formTab = now.find((t) => t.id === activeId);
      if (!formTab || formTab.locked) return;
      // A tab with a name of its own keeps it as the form's heading; a default one, or Untitled Form, takes the draft's.
      const own =
        isDefaultTabName(formTab.name) || formTab.name === UNTITLED_FORM ? undefined : formTab.name;
      const heading = own ?? draft.form.heading;
      const make = live.current.makeSheet;
      const plan = planFormDraft({
        draft,
        target,
        formTab,
        tabs: now,
        types: slice.types,
        statusNames: [...names],
        // Made at once through the sheet store; without it, placed, to be made on opening.
        newSheetId: make
          ? newPlanSheetId
          : () =>
              placeNewSheet({ title: `${heading} Responses`.slice(0, 80), blank: true }).sheetId,
        ...(own ? { heading: own } : {}),
      });
      const form = plan.form;
      commitTabs((ts) => {
        const next = ts.map((t) =>
          t.id === activeId
            ? { ...t, name: form.heading, kind: 'form' as const, form, dashboard: undefined }
            : plan.changedTab && t.id === plan.changedTab.id
              ? plan.changedTab
              : t,
        );
        if (plan.newTab) next.splice(next.findIndex((t) => t.id === activeId) + 1, 0, plan.newTab);
        return next;
      });
      if (plan.newTab) live.current.markTabLoaded?.(plan.newTab.id);
      if (plan.newSheet) {
        if (make)
          make({
            id: plan.newSheet.sheetId,
            tabId: plan.newSheet.tabId,
            title: plan.newSheet.title,
          });
        else live.current.openTab?.(plan.newSheet.tabId);
      }
      // The card type is a catalogue change of its own: it stays after an undo, as a starter's does.
      if (plan.type) slice.saveType(plan.type);
      track('Form', 'Created', 'FormDraft');
    },
    [activeId, commitTabs, live],
  );

  const newFormFor = useCallback<FormActions['newFormFor']>(
    (boardElementId) => {
      const { tabs: now, itemTypes: slice, statusNames: names } = live.current;
      const boardTab = now.find((t) => boardsOf(t).some((b) => b.element.id === boardElementId));
      const board = boardTab && boardsOf(boardTab).find((b) => b.element.id === boardElementId);
      if (!boardTab || !board || boardTab.locked) return;
      const name = `${board.setup.title || boardTab.name} Form`.slice(0, 80);
      const formTab: Tab = {
        id: crypto.randomUUID(),
        name,
        elements: [],
        kind: 'form',
        ...(boardTab.theme ? { theme: boardTab.theme } : {}),
      };
      const plan = planFormStart({
        starter: formStarter('blank'),
        formTab,
        tabs: now,
        types: slice.types,
        statusNames: [...names],
        board: { tabId: boardTab.id, elementId: boardElementId },
      });
      // A Blank form takes the board's first card type and first column (planFormStart, given the board).
      const made: Tab = { ...formTab, form: { ...plan.form, heading: name } };
      live.current.commitAnyTabs((ts) => {
        const at = ts.findIndex((t) => t.id === boardTab.id);
        const next = [...ts];
        next.splice(at + 1, 0, made);
        if (plan.newBoardTab) next.splice(at + 2, 0, plan.newBoardTab);
        return next;
      });
      live.current.markTabLoaded?.(made.id);
      if (plan.newBoardTab) live.current.markTabLoaded?.(plan.newBoardTab.id);
      if (plan.saveType) slice.saveType(plan.type);
      live.current.openTab?.(made.id);
      track('Form', 'Created', 'FromBoard');
    },
    // One identity for the editor's life: it rides in the Plan context, and a new one each render redrew every card
    // of every board on any edit (docs/specs/026-plan/plan-board.md "A busy board").
    [live],
  );

  const changeForm = useCallback<FormActions['changeForm']>(
    (change) =>
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== activeId) return t;
          const before = readForm(t.form) ?? blankForm(t.name);
          const after = change(before);
          return after === before ? t : { ...t, form: after };
        }),
      ),
    [activeId, commitTabs],
  );

  const changeFormQuietly = useCallback<FormActions['changeFormQuietly']>(
    (change) =>
      tickTabs((ts) =>
        ts.map((t) => {
          if (t.id !== activeId) return t;
          const before = readForm(t.form) ?? blankForm(t.name);
          const after = change(before);
          return after === before ? t : { ...t, form: after };
        }),
      ),
    [activeId, tickTabs],
  );

  const renameForm = useCallback<FormActions['renameForm']>(
    (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const formTab = live.current.tabs.find((t) => t.id === activeId);
      if (!formTab) return;
      const form = readForm(formTab.form) ?? blankForm(formTab.name);
      // Where responses go, renamed with the form while on its automatic name (withAutoBoardName).
      const destId = form.sheet?.tabId ?? form.destination?.tabId;
      const dest = live.current.tabs.find((t) => t.id === destId);
      const followed = dest
        ? withAutoBoardName(dest, { heading: form.heading, to: trimmed })
        : null;
      commitTabs((ts) =>
        ts.map((t) =>
          t.id === activeId
            ? { ...t, name: trimmed, form: { ...form, heading: trimmed } }
            : followed && t.id === followed.id
              ? followed
              : t,
        ),
      );
      // A Sheet tab's sheet keeps its tab's name, as when the tab itself is renamed.
      if (dest && followed && followed !== dest && form.sheet)
        live.current.retitleSheets?.([form.sheet.sheetId], dest.name, followed.name);
    },
    [activeId, commitTabs, live],
  );

  const addFieldFor = useCallback<FormActions['addFieldFor']>(
    (question, type) => {
      const slice = live.current.itemTypes;
      const current = slice.types.find((t) => t.id === type.id) ?? type;
      const label = newFieldLabel(question.prompt, current.custom?.map((f) => f.label) ?? []);
      const id = newCustomFieldId(label, [
        ...current.fields,
        ...(current.custom ?? []).map((f) => f.id),
      ]);
      if ((current.custom?.length ?? 0) >= 12) return null;
      const field = newFieldFor(question, id, label);
      slice.saveType({
        ...current,
        fields: [...current.fields, id],
        custom: [...(current.custom ?? []), field],
      });
      return id;
    },
    [live],
  );

  const syncFieldOptions = useCallback<FormActions['syncFieldOptions']>(
    (type, fieldId, options) => {
      const slice = live.current.itemTypes;
      const current = slice.types.find((t) => t.id === type.id) ?? type;
      const field = current.custom?.find((f) => f.id === fieldId);
      if (!field || (field.kind !== 'choice' && field.kind !== 'multichoice')) return;
      // An option no longer on the question stays on the field: a card may hold it.
      const keep = (field.options ?? []).filter(
        (o) => !options.some((x) => x.toLowerCase() === o.toLowerCase()),
      );
      const next = [...options, ...keep].slice(0, 20);
      if (next.join('\n') === (field.options ?? []).join('\n')) return;
      slice.saveType({
        ...current,
        custom: current.custom!.map((f) => (f.id === fieldId ? { ...f, options: next } : f)),
      });
    },
    [live],
  );

  const newResponsesBoard = useCallback<FormActions['newResponsesBoard']>(() => {
    const { tabs: now, itemTypes: slice, statusNames: names } = live.current;
    const formTab = now.find((t) => t.id === activeId);
    if (!formTab || formTab.locked) return;
    // A sheet it named (one since removed, the connect box asking again) goes: the new board is where responses go.
    const { sheet: _gone, ...form } = readForm(formTab.form) ?? blankForm(formTab.name);
    // The form's type when it has one; else the project's first; else a new Response type.
    const typeId =
      form.destination?.typeId ?? slice.types[0]?.id ?? newItemTypeId('Response', slice.types);
    const type = slice.types.find((t) => t.id === typeId);
    if (!type) slice.saveType(starterBaseType(formStarter('blank'), slice.types, typeId));
    // A type with its own statuses gets them as the board's columns, the board taking it alone
    // (docs/specs/030-forms/forms.md "Columns follow the card type").
    const tab = responsesBoardTab(form.heading, formTab, [...names], undefined, undefined, {
      typeId,
      statuses: type?.statuses,
      columns: now.flatMap((t) => boardsOf(t).flatMap((b) => b.setup.columns)),
    });
    const setup = boardsOf(tab)[0]!.setup;
    const fixed = form.destination?.fixed;
    commitTabs((ts) => {
      const next = ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              form: {
                ...form,
                destination: {
                  tabId: tab.id,
                  typeId,
                  status: setup.columns[0]!.status,
                  ...(fixed ? { fixed } : {}),
                },
              },
            }
          : t,
      );
      next.splice(next.findIndex((t) => t.id === activeId) + 1, 0, tab);
      return next;
    });
    live.current.markTabLoaded?.(tab.id);
  }, [activeId, commitTabs, live]);

  const newCardType = useCallback<FormActions['newCardType']>(() => {
    const { tabs: now, itemTypes: slice } = live.current;
    const formTab = now.find((t) => t.id === activeId);
    if (!formTab || formTab.locked) return;
    const form = readForm(formTab.form) ?? blankForm(formTab.name);
    const label = uniqueTypeLabel(form.heading, slice.types);
    const blank: ItemTypeDef = {
      ...starterBaseType(formStarter('blank'), slice.types, newItemTypeId(label, slice.types)),
      label,
      newTitle: `New ${label.toLowerCase()}`,
    };
    const dest = form.destination;
    // A field for each question that would otherwise land in Description, each mapped to it, in the same step as
    // the type change (docs/specs/030-forms/forms.md "Fields from the form's questions").
    const withFields = dest ? withQuestionFields(form, blank) : null;
    const type = withFields?.type ?? blank;
    const mapped = withFields?.form ?? form;
    slice.saveType(type);
    const from = slice.types.find((t) => t.id === dest?.typeId)?.label;
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id === activeId)
          return dest
            ? { ...t, form: { ...mapped, destination: { ...dest, typeId: type.id } } }
            : t;
        // The board a type list confines takes the new type too, and follows its name while on an automatic one.
        if (dest && t.id === dest.tabId)
          return withAutoBoardName(withBoardTaking(t, type.id), {
            heading: form.heading,
            from,
            to: type.label,
          });
        return t;
      }),
    );
  }, [activeId, commitTabs, live]);

  const setResponsesTo = useCallback<FormActions['setResponsesTo']>(
    (to) =>
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== activeId) return t;
          const form = readForm(t.form) ?? blankForm(t.name);
          const { sheet: _gone, ...rest } = form;
          return {
            ...t,
            form:
              to.kind === 'sheet'
                ? { ...rest, sheet: { tabId: to.tabId, sheetId: to.sheetId } }
                : rest,
          };
        }),
      ),
    [activeId, commitTabs],
  );

  const newResponsesSheet = useCallback<FormActions['newResponsesSheet']>(() => {
    const { tabs: now } = live.current;
    const formTab = now.find((t) => t.id === activeId);
    if (!formTab || formTab.locked) return;
    const form = readForm(formTab.form) ?? blankForm(formTab.name);
    const title = `${form.heading} Responses`.slice(0, 80);
    const make = live.current.makeSheet;
    // Made at once through the sheet store, so the form stays open; without it, placed, to be made on opening.
    const { sheetId } = make
      ? { sheetId: newPlanSheetId() }
      : placeNewSheet({ title, blank: true });
    const sheetTab = responsesSheetTab(form.heading, formTab, sheetId);
    commitTabs((ts) => {
      const next = ts.map((t) =>
        t.id === activeId ? { ...t, form: { ...form, sheet: { tabId: sheetTab.id, sheetId } } } : t,
      );
      next.splice(next.findIndex((t) => t.id === activeId) + 1, 0, sheetTab);
      return next;
    });
    live.current.markTabLoaded?.(sheetTab.id);
    if (make) make({ id: sheetId, tabId: sheetTab.id, title });
    // A placed sheet is made when its tab first draws it: opened, it exists for the first response.
    else live.current.openTab?.(sheetTab.id);
  }, [activeId, commitTabs, live]);

  // Responses Go To's board and card type, and the questions they bring (useFormDestinationActions).
  const { setDestinationType, setDestinationBoard, addTypeQuestions, addQuestionFields } =
    useFormDestinationActions({
      activeId,
      commitTabs,
      live,
      blankForm,
    });

  return useMemo(
    () => ({
      startForm,
      startDraftedForm,
      newFormFor,
      changeForm,
      changeFormQuietly,
      renameForm,
      addFieldFor,
      syncFieldOptions,
      newResponsesBoard,
      newCardType,
      setDestinationType,
      setDestinationBoard,
      addTypeQuestions,
      addQuestionFields,
      setResponsesTo,
      newResponsesSheet,
    }),
    [
      startForm,
      startDraftedForm,
      newFormFor,
      changeForm,
      changeFormQuietly,
      renameForm,
      addFieldFor,
      syncFieldOptions,
      newResponsesBoard,
      newCardType,
      setDestinationType,
      setDestinationBoard,
      addTypeQuestions,
      addQuestionFields,
      setResponsesTo,
      newResponsesSheet,
    ],
  );
}
