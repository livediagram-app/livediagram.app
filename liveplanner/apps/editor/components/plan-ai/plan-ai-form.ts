// Plan AI's changes to a form (docs/specs/026-plan/plan-ai.md "On a form"): change_form's changes, each checked against
// its schema, made on a draft of the form exactly as an agent's are (applyFormChanges), all or none, and the form
// taken whole as one change (changeForm, one undo step). A change that would make a card type, a board or a tab (where
// responses go) is left to Form Settings and said so: Plan AI changes the form itself. Pure.
import {
  applyFormChanges,
  changeFormShape,
  draftOf,
  type FormChange,
  type FormWorld,
} from '@liveplanner/agent-verbs/assist';
import { newFormPartId, type FormDefinition } from '@liveplanner/forms';
import type { ItemTypeDef, PlanAiChange } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { forPeople, unreadableChange, type PlanAiLine } from './plan-ai-lines';

const formChange = changeFormShape.changes.element;

const SETTINGS_ONLY =
  'That would change where responses go, so nothing was changed: set it in Form Settings.';

/** The form after `changes`, with a line for each; or, when any can't be made, the form unchanged and why. */
export function applyFormTurn(input: {
  projectId: string;
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>;
  form: FormDefinition;
  tabs: readonly { id: string; name: string; kind?: string }[];
  types: readonly ItemTypeDef[];
  changes: readonly PlanAiChange[];
  newId?: (prefix: 'q' | 's') => string;
}): { form: FormDefinition | null; lines: PlanAiLine[] } {
  const parsed: FormChange[] = [];
  for (const raw of input.changes) {
    const read = formChange.safeParse(raw);
    if (!read.success)
      return { form: null, lines: [{ text: unreadableChange(raw.op), ok: false }] };
    parsed.push(read.data);
  }
  const world: FormWorld = {
    projectId: input.projectId,
    tabs: input.tabs.map((t) => ({ id: t.id, name: t.name, kind: t.kind ?? 'diagram' })),
    boards: [],
    sheets: [],
    types: input.types,
    statuses: [],
    itemTypesRev: 0,
  };
  const d = draftOf(world, input.formTab, input.form, input.newId ?? newFormPartId);
  const refused = applyFormChanges(d, parsed);
  if (refused) return { form: null, lines: [{ text: forPeople(refused.message), ok: false }] };
  if (d.typesChanged || d.newTabs.length || d.changedBoards.size)
    return { form: null, lines: [{ text: SETTINGS_ONLY, ok: false }] };
  return {
    form: d.form,
    lines: d.lines.map((line) => ({ text: line[0]!.toUpperCase() + line.slice(1), ok: true })),
  };
}
