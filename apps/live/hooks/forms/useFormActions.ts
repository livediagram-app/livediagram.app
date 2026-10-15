'use client';

// The Form tab's editor actions (docs/specs/030-forms/forms.md "Starting a form", "Building a form"): a starter made
// into a Form tab (and a Board tab for its responses when the document has none that fits), each builder edit as one
// tab change and one undo step, and the card type changes a mapping needs. A locked tab refuses every change, as
// every edit there is.
import { useCallback, useMemo } from 'react';
import {
  formStarter,
  starterBaseType,
  newFieldFor,
  readForm,
  UNTITLED_FORM,
  type FormDefinition,
  type FormQuestion,
  type StarterId,
} from '@livediagram/forms';
import { isDefaultTabName, newPlanSheetId, type Tab } from '@livediagram/document';
import { placeNewSheet } from '@/lib/sheet-seeds';
import { newCustomFieldId, newItemTypeId, type ItemTypeDef } from '@livediagram/items';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  boardsOf,
  planFormStart,
  responsesBoardTab,
  responsesSheetTab,
  uniqueTypeLabel,
  withAutoBoardName,
  withBoardTaking,
} from '@livediagram/templates';

export type FormActions = {
  // A starter chosen on Start Planning: the tab becomes a Form tab holding it.
  startForm: (starter: StarterId) => void;
  // New Form on a board's cog: a Blank form on a new Form tab after the board's, its responses going to that board,
  // opened.
  newFormFor: (boardElementId: string) => void;
  // One builder edit to the active Form tab's form; `kind` names it for telemetry where it is counted.
  changeForm: (change: (form: FormDefinition) => FormDefinition) => void;
  // The heading, which is the tab's name too: both in one step, and the board or sheet its responses go to follows
  // while it is still on its automatic name ("<Form> Responses").
  renameForm: (name: string) => void;
  // New Field "<Prompt>": a custom field of the question's kind on the destination's card type; answers its id.
  addFieldFor: (question: FormQuestion, type: ItemTypeDef) => string | null;
  // A choice question's options changed: the field it maps to follows (one catalogue change).
  syncFieldOptions: (type: ItemTypeDef, fieldId: string, options: readonly string[]) => void;
  // Responses Go To's New Board: a Board tab after this one, "<Form> Responses", its New column the destination.
  newResponsesBoard: () => void;
  // Responses Go To's New Card Type: a type named after the form, taken by the destination's board, now the type.
  newCardType: () => void;
  // Responses Go To's Card Type: the destination's type, its board renamed "<Type> Responses" while on its automatic
  // name (withAutoBoardName), one step.
  setDestinationType: (typeId: string) => void;
  // Responses Go To's Board or Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): to a Sheet, the given one
  // (or the document's first); to a Board, the sheet let go (the board destination was kept).
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
                opensIn: 'plan' as const,
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
        opensIn: 'plan',
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
      commitAnyTabs((ts) => {
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
    [commitAnyTabs, live],
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
      const taken = new Set(current.custom?.map((f) => f.label.toLowerCase()));
      const base = (question.prompt.trim() || 'Answer').slice(0, 32);
      let label = base;
      for (let n = 2; taken.has(label.toLowerCase()); n += 1) label = `${base.slice(0, 28)} ${n}`;
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
    const form = readForm(formTab.form) ?? blankForm(formTab.name);
    const tab = responsesBoardTab(form.heading, formTab, [...names]);
    const setup = boardsOf(tab)[0]!.setup;
    // The form's type when it has one; else the document's first; else a new Response type.
    const typeId =
      form.destination?.typeId ?? slice.types[0]?.id ?? newItemTypeId('Response', slice.types);
    if (!slice.types.some((t) => t.id === typeId))
      slice.saveType(starterBaseType(formStarter('blank'), slice.types, typeId));
    commitTabs((ts) => {
      const next = ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              form: {
                ...form,
                destination: { tabId: tab.id, typeId, status: setup.columns[0]!.status },
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
    const type: ItemTypeDef = {
      ...starterBaseType(formStarter('blank'), slice.types, newItemTypeId(label, slice.types)),
      label,
      newTitle: `New ${label.toLowerCase()}`,
    };
    slice.saveType(type);
    const dest = form.destination;
    const from = slice.types.find((t) => t.id === dest?.typeId)?.label;
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id === activeId)
          return dest ? { ...t, form: { ...form, destination: { ...dest, typeId: type.id } } } : t;
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

  const setDestinationType = useCallback<FormActions['setDestinationType']>(
    (typeId) => {
      const { tabs: now, itemTypes: slice } = live.current;
      const formTab = now.find((t) => t.id === activeId);
      if (!formTab) return;
      const form = readForm(formTab.form) ?? blankForm(formTab.name);
      const dest = form.destination;
      const to = slice.types.find((t) => t.id === typeId);
      if (!dest || !to || dest.typeId === typeId) return;
      const from = slice.types.find((t) => t.id === dest.typeId)?.label;
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id === activeId)
            return { ...t, form: { ...form, destination: { ...dest, typeId } } };
          if (t.id === dest.tabId)
            return withAutoBoardName(t, { heading: form.heading, from, to: to.label });
          return t;
        }),
      );
    },
    [activeId, commitTabs, live],
  );

  return useMemo(
    () => ({
      startForm,
      newFormFor,
      changeForm,
      renameForm,
      addFieldFor,
      syncFieldOptions,
      newResponsesBoard,
      newCardType,
      setDestinationType,
      setResponsesTo,
      newResponsesSheet,
    }),
    [
      startForm,
      newFormFor,
      changeForm,
      renameForm,
      addFieldFor,
      syncFieldOptions,
      newResponsesBoard,
      newCardType,
      setDestinationType,
      setResponsesTo,
      newResponsesSheet,
    ],
  );
}
