// A form as an agent reads it (docs/specs/030-forms/forms.md "Agents": read_form): its sections and questions in
// words, where each answer goes by the field's name, where responses go, its settings, state, count, link and the
// problems Share Form would list. Pure: the verbs read the world and the link, this says what they hold.
import type { FormLinkResponse } from '@livediagram/api-schema';
import {
  DEFAULT_CLOSED_MESSAGE,
  DEFAULT_CONFIRMATION,
  DESTINATION_PROBLEM_TEXT,
  PUBLISH_PROBLEM_TEXT,
  QUESTION_TYPE_NAMES,
  closedReason,
  destinationProblem,
  destinationType,
  effectiveTarget,
  promptOf,
  publishProblems,
  ruleQuestion,
  sheetDestinationProblem,
  sheetHeaders,
  type ClosedReason,
  type DestinationProblem,
  type FormDefinition,
  type FormQuestion,
} from '@livediagram/forms';
import type { ItemTypeDef } from '@livediagram/items';
import type { BoardRef, SheetRef } from './form-world';

export type FormState = 'not_published' | 'accepting' | 'closed' | 'paused' | 'suspended';

export interface ReadQuestion extends Omit<
  FormQuestion,
  'goesTo' | 'required' | 'other' | 'dropdown' | 'whole'
> {
  typeName: string;
  required?: boolean;
  other?: boolean;
  dropdown?: boolean;
  whole?: boolean;
  // Title, Description, or the card field's name; absent on a sheet form (each answer its own column).
  goesTo?: string;
  goesToBroken?: true;
  // Sheet forms: the header of the column its answers fill.
  column?: string;
}

export interface FormReading {
  tabId: string;
  heading: string;
  description?: string;
  state: FormState;
  closedReason?: ClosedReason;
  // The form link's code: an Editor's only.
  code: string | null;
  responses: number;
  unseen: number;
  respondsTo:
    | { to: 'board'; board: string; cardType: string; column: string }
    | { to: 'sheet'; sheet: string }
    | { to: 'nowhere' };
  respondsToProblem?: string;
  sections: {
    id: string;
    place: number;
    title?: string;
    description?: string;
    showIf?: { questionId: string; prompt: string; anyOf: string[] };
    showIfBroken?: true;
    questions: ReadQuestion[];
  }[];
  cover?: FormDefinition['cover'];
  settings: { closesAt?: string; limit?: number; confirmation: string; closedMessage: string };
  problems: string[];
}

function readQuestion(
  q: FormQuestion,
  type: ItemTypeDef | undefined,
  // A sheet form's column for it; a board form's answer goes to a card instead.
  column: string | undefined,
): ReadQuestion {
  const { goesTo: _g, required, other, dropdown, whole, ...rest } = q;
  const out: ReadQuestion = { ...rest, prompt: promptOf(q), typeName: QUESTION_TYPE_NAMES[q.type] };
  if (required) out.required = true;
  if (other) out.other = true;
  if (dropdown) out.dropdown = true;
  if (whole) out.whole = true;
  if (column !== undefined) return { ...out, column };
  const target = effectiveTarget(q, type);
  out.goesTo =
    target.to === 'title'
      ? 'Title'
      : target.to === 'field'
        ? (target.field?.label ?? 'Description')
        : 'Description';
  if (target.broken) out.goesToBroken = true;
  return out;
}

export function readFormOf(input: {
  tabId: string;
  form: FormDefinition;
  boards: readonly BoardRef[];
  sheets: readonly SheetRef[];
  // Tab names by id, for a destination whose board is gone from its tab.
  tabNames?: ReadonlyMap<string, string>;
  types: readonly ItemTypeDef[];
  link: FormLinkResponse | null;
  now?: number;
}): FormReading {
  const { form, boards: allBoards, sheets, types, link } = input;
  const type = destinationType(form.destination, types);
  // Where responses go, and what stops them landing.
  let respondsTo: FormReading['respondsTo'] = { to: 'nowhere' };
  let problem: DestinationProblem | null;
  if (form.sheet) {
    problem = sheetDestinationProblem(form.sheet, sheets);
    const named = sheets.find((s) => s.sheetId === form.sheet!.sheetId);
    respondsTo = { to: 'sheet', sheet: named?.name ?? '(removed)' };
  } else if (form.destination) {
    const dest = form.destination;
    const onTab = allBoards.filter((b) => b.tabId === dest.tabId);
    problem = destinationProblem(
      dest,
      onTab.map((b) => ({ columns: b.columns, addTypes: b.types ?? undefined })),
      types,
    );
    const column = onTab.flatMap((b) => b.columns).find((c) => c.status === dest.status);
    respondsTo = {
      to: 'board',
      board: onTab[0]?.tabName ?? input.tabNames?.get(dest.tabId) ?? '(removed)',
      cardType: type?.label ?? '(removed)',
      column: column?.name ?? '(removed)',
    };
  } else problem = 'no_destination';
  // A sheet form's column for each question, as a response finds it (its header).
  const columns = form.sheet ? new Map(sheetHeaders(form).map((h) => [h.key, h.header])) : null;
  const live = link?.link ?? null;
  let state: FormState = 'not_published';
  let reason: ClosedReason | null = null;
  if (live) {
    reason = closedReason(form, {
      open: live.open,
      responses: link!.responses,
      now: input.now ?? Date.now(),
    });
    // A sheet form has no board destination; closedReason reads that as nowhere to go.
    if (reason === 'no_destination' && form.sheet) reason = null;
    state = reason ? 'closed' : problem ? 'paused' : 'accepting';
  } else if (link?.suspendedAt) state = 'suspended';
  const problems = [
    ...(problem ? [`Responses have nowhere to go: ${DESTINATION_PROBLEM_TEXT[problem]}`] : []),
    // Each in Share Form's words, naming the question or section it is about.
    ...publishProblems(form, form.sheet ? undefined : type).map((p) => {
      const text = PUBLISH_PROBLEM_TEXT[p.kind];
      if ('questionId' in p) {
        const q = form.sections.flatMap((s) => s.questions).find((x) => x.id === p.questionId);
        return `${text} (${q ? `"${promptOf(q)}", ` : ''}${p.questionId})`;
      }
      if ('sectionId' in p)
        return `${text} (section ${form.sections.findIndex((s) => s.id === p.sectionId) + 1})`;
      return text;
    }),
  ];
  return {
    tabId: input.tabId,
    heading: form.heading,
    ...(form.description ? { description: form.description } : {}),
    state,
    ...(reason ? { closedReason: reason } : {}),
    code: live?.code || null,
    responses: link?.responses ?? 0,
    unseen: link?.unseen ?? 0,
    respondsTo,
    ...(problem ? { respondsToProblem: DESTINATION_PROBLEM_TEXT[problem] } : {}),
    sections: form.sections.map((s, i) => {
      const rule = s.showIf ? ruleQuestion(form, i, s.showIf) : null;
      return {
        id: s.id,
        place: i + 1,
        ...(i > 0 && s.title ? { title: s.title } : {}),
        ...(i > 0 && s.description ? { description: s.description } : {}),
        ...(s.showIf
          ? {
              showIf: {
                questionId: s.showIf.questionId,
                prompt: rule ? promptOf(rule) : '(removed)',
                anyOf: s.showIf.anyOf,
              },
            }
          : {}),
        ...(s.showIf && !rule ? { showIfBroken: true as const } : {}),
        questions: s.questions.map((q) => readQuestion(q, type, columns?.get(q.id))),
      };
    }),
    ...(form.cover ? { cover: form.cover } : {}),
    settings: {
      ...(form.closesAt !== undefined ? { closesAt: new Date(form.closesAt).toISOString() } : {}),
      ...(form.limit !== undefined ? { limit: form.limit } : {}),
      confirmation: form.confirmation ?? DEFAULT_CONFIRMATION,
      closedMessage: form.closedMessage ?? DEFAULT_CLOSED_MESSAGE,
    },
    problems,
  };
}
