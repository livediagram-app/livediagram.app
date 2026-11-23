// What a form link shows (docs/specs/030-forms/forms.md "Filling in a form", blueprint §8): the form as respondents
// see it. Never its destination, its mappings or its starter: those are the project's business.
import { DEFAULT_CLOSED_MESSAGE, DEFAULT_CONFIRMATION, MONTHLY_LIMIT_MESSAGE } from './limits';
import type { FormCover, FormDefinition, FormQuestion, FormSection } from './model';

export type PublicQuestion = Omit<FormQuestion, 'goesTo'>;
export interface PublicSection extends Omit<FormSection, 'questions'> {
  questions: PublicQuestion[];
}

export interface PublicForm {
  heading: string;
  description?: string;
  cover?: FormCover;
  width?: 'wide';
  sections: PublicSection[];
  confirmation: string;
}

export function publicForm(form: FormDefinition): PublicForm {
  const out: PublicForm = {
    heading: form.heading,
    sections: form.sections.map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.description ? { description: s.description } : {}),
      // The page needs a section's rule to know when to show it.
      ...(s.showIf
        ? { showIf: { questionId: s.showIf.questionId, anyOf: [...s.showIf.anyOf] } }
        : {}),
      questions: s.questions.map(({ goesTo: _goesTo, ...q }) => q),
    })),
    confirmation: form.confirmation ?? DEFAULT_CONFIRMATION,
  };
  if (form.description) out.description = form.description;
  if (form.cover) out.cover = { ...form.cover };
  if (form.width === 'wide') out.width = 'wide';
  return out;
}

// Why a form takes no responses now, or null while it does (docs/specs/030-forms/forms.md "Publishing").
// `monthly_limit`: its owner's month of responses is used (forms.md "Abuse and limits → Tiers"), which is nothing of the
// form's own doing: it opens again by itself.
export type ClosedReason =
  'switched_off' | 'closes_at' | 'limit' | 'no_destination' | 'monthly_limit';

// What a closed form's page says: the form's own Closed Message, or for a month that is full one neutral line that
// names no limit (the respondent can do nothing about it).
export const closedMessageOf = (
  form: Pick<FormDefinition, 'closedMessage'>,
  reason?: ClosedReason | null,
) =>
  reason === 'monthly_limit'
    ? MONTHLY_LIMIT_MESSAGE
    : (form.closedMessage ?? DEFAULT_CLOSED_MESSAGE);

// Closed by the form's own Settings, whatever its switch says: past its Close On, or at its Response Limit. The
// editor's status bar and the Form Status metric ask this too, so a switched-on form there reads Closed when it is.
export function closedBySettings(
  form: Pick<FormDefinition, 'closesAt' | 'limit'>,
  state: { responses: number; now: number },
): 'closes_at' | 'limit' | null {
  if (form.closesAt !== undefined && state.now >= form.closesAt) return 'closes_at';
  if (form.limit !== undefined && state.responses >= form.limit) return 'limit';
  return null;
}

export function closedReason(
  form: Pick<FormDefinition, 'closesAt' | 'limit' | 'destination' | 'sheet'>,
  // `monthFull`: its owner's month of responses is used (absent where nothing counts them).
  state: {
    open: boolean;
    responses: number;
    now: number;
    monthFull?: boolean;
  },
): ClosedReason | null {
  if (!state.open) return 'switched_off';
  // A board or a sheet: rows in a sheet need no board (a sheet starter names none).
  if (!form.destination && !form.sheet) return 'no_destination';
  const own = closedBySettings(form, state);
  if (own) return own;
  return state.monthFull ? 'monthly_limit' : null;
}
