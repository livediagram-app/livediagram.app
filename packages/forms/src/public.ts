// What a form link shows (docs/specs/030-forms/forms.md "Filling in a form", blueprint §8): the form as respondents
// see it. Never its destination, its mappings or its starter: those are the document's business.
import { DEFAULT_CLOSED_MESSAGE, DEFAULT_CONFIRMATION } from './limits';
import type { FormCover, FormDefinition, FormQuestion, FormSection } from './model';

export type PublicQuestion = Omit<FormQuestion, 'goesTo'>;
export interface PublicSection extends Omit<FormSection, 'questions'> {
  questions: PublicQuestion[];
}

export interface PublicForm {
  heading: string;
  description?: string;
  cover?: FormCover;
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
  return out;
}

export const closedMessageOf = (form: Pick<FormDefinition, 'closedMessage'>) =>
  form.closedMessage ?? DEFAULT_CLOSED_MESSAGE;

// Why a form takes no responses now, or null while it does (docs/specs/030-forms/forms.md "Publishing").
export type ClosedReason = 'switched_off' | 'closes_at' | 'limit' | 'no_destination';

export function closedReason(
  form: Pick<FormDefinition, 'closesAt' | 'limit' | 'destination'>,
  state: { open: boolean; responses: number; now: number },
): ClosedReason | null {
  if (!state.open) return 'switched_off';
  if (!form.destination) return 'no_destination';
  if (form.closesAt !== undefined && state.now >= form.closesAt) return 'closes_at';
  if (form.limit !== undefined && state.responses >= form.limit) return 'limit';
  return null;
}
