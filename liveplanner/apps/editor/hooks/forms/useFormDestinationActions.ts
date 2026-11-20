'use client';

// Responses Go To's card type (docs/specs/030-forms/forms.md "Responses Go To", "Columns follow the card type",
// "Questions from the card type's fields"): choosing it moves the column to one the type uses on the boards that take
// it and keeps the values set automatically that still fit, one step; on a form with no questions the type's questions follow as a step of their
// own, so Undo takes them away and leaves the choice made. Add Fields for Questions goes the other way: a field on the
// type for each question whose answer would otherwise land in Description ("Fields from the form's questions").
import { useCallback, useMemo, type RefObject } from 'react';
import {
  columnForType,
  fixedKeptFor,
  newFormPartId,
  questionsOf,
  readForm,
  withQuestionFields,
  withTypeQuestions,
  type FormDefinition,
} from '@liveplanner/forms';
import type { Tab } from '@liveplanner/project';
import { targetColumns, type ItemTypeDef } from '@liveplanner/items';
import { withAutoBoardName } from '@liveplanner/templates';
import { boardsShowingOf, planBoardsOf } from '@/components/forms/form-destination';
import { track } from '@/lib/telemetry';

export type FormDestinationActions = {
  // Responses Go To's Card Type: the destination's type (a form with none yet gains its destination), its column one
  // the type uses on the boards that take it (columnForType), the board its cards show on renamed "<Type> Responses"
  // while on its automatic name (withAutoBoardName), one step; on a form with no questions, then a question for each
  // of the type's fields as a step of its own. Answers false when no board has a column for the type, so nothing
  // could be chosen: the caller adds a board for it (newResponsesBoard).
  setDestinationType: (typeId: string) => boolean;
  // Add Questions for {Type}'s Fields: a question for each field of the destination's type no question asks, one step.
  addTypeQuestions: () => void;
  // Add Fields for Questions: a field on the destination's type for each question going to Description for want of
  // one (withQuestionFields), each question mapped to its field; the type saved, the mappings one step.
  addQuestionFields: () => void;
};

type Live = RefObject<{
  tabs: readonly Tab[];
  itemTypes: { types: readonly ItemTypeDef[]; saveType: (type: ItemTypeDef) => void };
}>;

export function useFormDestinationActions({
  activeId,
  commitTabs,
  live,
  blankForm,
}: {
  activeId: string;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  live: Live;
  blankForm: (name: string) => FormDefinition;
}): FormDestinationActions {
  // The active form as it stands.
  const formOf = useCallback((t: Tab) => readForm(t.form) ?? blankForm(t.name), [blankForm]);

  // An empty form takes a question per field of `type`, its own undo step.
  const typeQuestionsStep = useCallback(
    (type: ItemTypeDef) => {
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== activeId) return t;
          const current = formOf(t);
          const next = withTypeQuestions(current, type, () => newFormPartId('q'));
          return next === current ? t : { ...t, form: next };
        }),
      );
      track('Form', 'Added', 'FromCardType');
    },
    [activeId, commitTabs, formOf],
  );

  const setDestinationType = useCallback<FormDestinationActions['setDestinationType']>(
    (typeId) => {
      const { tabs: now, itemTypes: slice } = live.current;
      const formTab = now.find((t) => t.id === activeId);
      if (!formTab) return true;
      const form = formOf(formTab);
      const dest = form.destination;
      const to = slice.types.find((t) => t.id === typeId);
      if (!to || dest?.typeId === typeId) return true;
      const from = slice.types.find((t) => t.id === dest?.typeId)?.label;
      // The column moves to one the new type uses on the boards that take it; set values stay while their fields do.
      const boards = planBoardsOf(now);
      const columns = targetColumns(
        boards.map((b) => b.setup),
        slice.types,
        typeId,
      );
      const status = columnForType(columns, to, dest?.status) ?? dest?.status;
      if (!status) return false;
      const { fixed: _was, tabId: _tab, typeRules: _rules, ...plain } = dest ?? {};
      const fixed = fixedKeptFor(dest?.fixed, to);
      // The tab it is seen on (a hint: FormDestination): the first board showing the new type's cards.
      const home = boardsShowingOf({ typeId, status }, boards, slice.types)[0]?.tab.id;
      const moved = {
        ...plain,
        ...(home ? { tabId: home } : {}),
        typeId,
        status,
        ...(fixed ? { fixed } : {}),
        // A rule on the new default type is dropped by readForm; the others stay.
        ...(dest?.typeRules
          ? { typeRules: dest.typeRules.filter((r) => r.typeId !== typeId) }
          : {}),
      };
      if (moved.typeRules && moved.typeRules.length === 0) delete moved.typeRules;
      const was = dest ? boardsShowingOf(dest, boards, slice.types)[0]?.tab.id : undefined;
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id === activeId) return { ...t, form: { ...form, destination: moved } };
          if (from && t.id === was && t.id === home)
            return withAutoBoardName(t, { heading: form.heading, from, to: to.label });
          return t;
        }),
      );
      if (questionsOf(form).length === 0) typeQuestionsStep(to);
      return true;
    },
    [activeId, commitTabs, formOf, live, typeQuestionsStep],
  );

  const addTypeQuestions = useCallback<FormDestinationActions['addTypeQuestions']>(() => {
    const { itemTypes: slice } = live.current;
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const form = formOf(t);
        const type = slice.types.find((x) => x.id === form.destination?.typeId);
        const next = type ? withTypeQuestions(form, type, () => newFormPartId('q')) : form;
        return next === form ? t : { ...t, form: next };
      }),
    );
    track('Form', 'Added', 'FromCardType');
  }, [activeId, commitTabs, formOf, live]);

  const addQuestionFields = useCallback<FormDestinationActions['addQuestionFields']>(() => {
    const { tabs: now, itemTypes: slice } = live.current;
    const formTab = now.find((t) => t.id === activeId);
    if (!formTab || formTab.locked) return;
    const form = formOf(formTab);
    const type = slice.types.find((x) => x.id === form.destination?.typeId);
    const made = type ? withQuestionFields(form, type) : null;
    if (!made) return;
    // The type is a catalogue change of its own, as New Field's is; the mappings are one step.
    slice.saveType(made.type);
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, form: made.form } : t)));
    track('Form', 'Added', 'FieldsFromQuestions');
  }, [activeId, commitTabs, formOf, live]);

  return useMemo(
    () => ({ setDestinationType, addTypeQuestions, addQuestionFields }),
    [setDestinationType, addTypeQuestions, addQuestionFields],
  );
}
