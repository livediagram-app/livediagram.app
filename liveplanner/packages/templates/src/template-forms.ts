// A Plan template's Form tab (docs/specs/030-forms/forms.md "In a plan template", blueprint §7a): the starter's form,
// built as Start Planning builds it (buildStarter), its responses going to one of the template's own tabs. Pure, and
// made with the tab on every path that makes a template's tabs, so the form exists the moment its project does. It
// starts unpublished: no link, no limit, no closing time.
import {
  buildStarter,
  formStarter,
  newFormPartId,
  starterBaseType,
  type FormDefinition,
  type FormStarter,
} from '@liveplanner/forms';
import { READY_MADE_CARD_TYPES } from '@liveplanner/items';
import type { BoardSpec, FormSpec, PlanTabSpec } from './plan-template-catalogue';

// The tab a template form's responses go to: a board's tab (its spec) or a Sheet's (its sheet's id).
export type TemplateFormTarget =
  { tabId: string; board: BoardSpec } | { tabId: string; sheetId: string } | null;

// The tab named `to` among a template's tab specs, given every tab's id and each Sheet's id in order: its board, or
// its Sheet; null when no tab has that name, it holds neither, or its id was not given.
export function templateFormTarget(
  specs: readonly Pick<PlanTabSpec, 'name' | 'board'>[],
  sheetIds: readonly (string | null)[],
  to: string,
  ids: readonly string[],
): TemplateFormTarget {
  const i = specs.findIndex((s) => s.name === to);
  const tabId = ids[i];
  if (i < 0 || !tabId) return null;
  const board = specs[i]!.board;
  if (board) return { tabId, board };
  const sheetId = sheetIds[i];
  return sheetId ? { tabId, sheetId } : null;
}

// `starter` with each field its questions map to renamed by `fields` (a starter label to the target type's label),
// so the question finds the type's own field rather than adding one. Nothing else changes.
export function starterWithFields(
  starter: FormStarter,
  fields: Readonly<Record<string, string>> | undefined,
): FormStarter {
  if (!fields) return starter;
  return {
    ...starter,
    sections: starter.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        typeof q.to === 'object' && fields[q.to.label]
          ? { ...q, to: { ...q.to, label: fields[q.to.label]! } }
          : q,
      ),
    })),
  };
}

// The ready-made card type a template board's responses are made as: the first it takes.
export function boardResponseType(board: BoardSpec) {
  const id = board.setup?.addTypes?.[0];
  return id ? READY_MADE_CARD_TYPES.find((t) => t.id === id) : undefined;
}

export function templateForm(
  spec: FormSpec,
  heading: string,
  target: TemplateFormTarget,
  random: () => number = Math.random,
): FormDefinition {
  const starter = starterWithFields(formStarter(spec.starter), spec.fields);
  const newId = (prefix: 'q' | 's') => newFormPartId(prefix, random);
  const type = target && 'board' in target ? boardResponseType(target.board) : undefined;
  const status = target && 'board' in target ? target.board.setup?.columns?.[0]?.status : undefined;
  const base = type ?? starterBaseType(starter, [], 'response');
  const { form } = buildStarter(starter, base, newId);
  const out: FormDefinition = { ...form, heading };
  if (target && 'sheetId' in target) out.sheet = { tabId: target.tabId, sheetId: target.sheetId };
  else if (target && type && status)
    out.destination = { tabId: target.tabId, typeId: type.id, status };
  return out;
}
