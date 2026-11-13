'use client';

// Responses Go To's board and card type (docs/specs/030-forms/forms.md "Columns follow the card type", "Questions from
// the card type's fields"): choosing either moves the column to one the type uses and keeps the values set
// automatically that still fit, one step; on a form with no questions the type's questions follow as a step of their
// own, so Undo takes them away and leaves the choice made.
import { useCallback, useMemo, type RefObject } from 'react';
import {
  columnForType,
  fixedKeptFor,
  newFormPartId,
  questionsOf,
  readForm,
  withTypeQuestions,
  type FormDefinition,
} from '@liveplanner/forms';
import type { Tab } from '@liveplanner/project';
import { boardAddTypes, type ItemTypeDef } from '@liveplanner/items';
import { boardsOf, withAutoBoardName } from '@liveplanner/templates';
import { track } from '@/lib/telemetry';

export type FormDestinationActions = {
  // Responses Go To's Card Type: the destination's type, its column one the type uses (columnForType), its board
  // renamed "<Type> Responses" while on its automatic name (withAutoBoardName), one step; on a form with no questions,
  // then a question for each of the type's fields as a step of its own.
  setDestinationType: (typeId: string) => void;
  // Responses Go To's Board: the board, its type the one kept while the board takes it (else the board's first), its
  // column one the type uses, set values kept while the type stays, one step; on a form with no questions, then the
  // type's questions as a step of their own.
  setDestinationBoard: (tabId: string) => void;
  // Add Questions for {Type}'s Fields: a question for each field of the destination's type no question asks, one step.
  addTypeQuestions: () => void;
};

type Live = RefObject<{
  tabs: readonly Tab[];
  itemTypes: { types: readonly ItemTypeDef[] };
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
      if (!formTab) return;
      const form = formOf(formTab);
      const dest = form.destination;
      const to = slice.types.find((t) => t.id === typeId);
      if (!dest || !to || dest.typeId === typeId) return;
      const from = slice.types.find((t) => t.id === dest.typeId)?.label;
      // The column moves to one the new type uses; set values stay while their fields do.
      const destTab = now.find((t) => t.id === dest.tabId);
      const boards = destTab ? boardsOf(destTab) : [];
      const board =
        boards.find((b) => b.setup.columns.some((c) => c.status === dest.status)) ?? boards[0];
      const status = columnForType(board?.setup.columns ?? [], to, dest.status) ?? dest.status;
      const { fixed: _was, ...plain } = dest;
      const fixed = fixedKeptFor(dest.fixed, to);
      const moved = { ...plain, typeId, status, ...(fixed ? { fixed } : {}) };
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id === activeId) return { ...t, form: { ...form, destination: moved } };
          if (t.id === dest.tabId)
            return withAutoBoardName(t, { heading: form.heading, from, to: to.label });
          return t;
        }),
      );
      if (questionsOf(form).length === 0) typeQuestionsStep(to);
    },
    [activeId, commitTabs, formOf, live, typeQuestionsStep],
  );

  const setDestinationBoard = useCallback<FormDestinationActions['setDestinationBoard']>(
    (tabId) => {
      const { tabs: now, itemTypes: slice } = live.current;
      const formTab = now.find((t) => t.id === activeId);
      const tab = now.find((t) => t.id === tabId && t.kind === 'board');
      const setup = tab ? boardsOf(tab)[0]?.setup : undefined;
      if (!formTab || !tab || !setup) return;
      const form = formOf(formTab);
      const dest = form.destination;
      const takes = boardAddTypes(setup, slice.types);
      const typeId =
        dest && takes.some((t) => t.id === dest.typeId)
          ? dest.typeId
          : (takes[0]?.id ?? dest?.typeId ?? '');
      // The board's first column the type uses; set values stay while the type does.
      const type = slice.types.find((t) => t.id === typeId);
      const status = columnForType(setup.columns, type, undefined) ?? setup.columns[0]!.status;
      const fixed = dest?.typeId === typeId ? dest.fixed : undefined;
      const destination = { tabId, typeId, status, ...(fixed ? { fixed } : {}) };
      commitTabs((ts) =>
        ts.map((t) => (t.id === activeId ? { ...t, form: { ...formOf(t), destination } } : t)),
      );
      // Only an empty form gains questions: one a person has started is never added to by a pick.
      if (type && questionsOf(form).length === 0) typeQuestionsStep(type);
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

  return useMemo(
    () => ({ setDestinationType, setDestinationBoard, addTypeQuestions }),
    [setDestinationType, setDestinationBoard, addTypeQuestions],
  );
}
