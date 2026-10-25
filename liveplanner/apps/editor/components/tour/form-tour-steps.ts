// The steps of the Forms tour (docs/specs/030-forms/forms.md "The Forms tour"), rebuilt to do rather than point: on the
// person's own Form tab it adds an example question, opens it to edit, opens its type menu, previews the form as a
// respondent, opens where responses go, visits where they land and opens sharing, then takes the example question
// away again (no undo step, so Undo never brings it back) and leaves Preview, whatever ends the tour.
import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';

export type FormTourApi = {
  destination: () => { tabId: string; kind: 'board' | 'sheet' } | null;
  openTab: (tabId: string) => void;
  backToForm: () => void;
  // The tour's example question: added to the end of the form (no undo step), opened in the builder, and its id.
  addQuestion: () => string | null;
  editQuestion: () => void;
  questionId: () => string | null;
  // The form shown as a respondent sees it, or back to editing.
  preview: (on: boolean) => void;
};

export type FormTourStep = TourStepOf<FormTourApi>;

const question = (api: FormTourApi, inner = '') => {
  const id = api.questionId();
  return id ? `[data-form-page] [data-form-question="${id}"]${inner}` : null;
};

const ADD: FormTourStep = {
  id: 'add',
  title: 'Add a Question',
  body: 'Add Question puts a new one below the one you are on, and the arrow beside it picks another type. Here is one we added.',
  prepare: (api) => {
    api.addQuestion();
  },
  selector: (api) => question(api),
};

const EDIT: FormTourStep = {
  id: 'edit',
  title: 'Edit It in Place',
  body: 'Click a question to edit it: its wording, a description, its answers and whether it must be answered.',
  prepare: (api) => api.editQuestion(),
  selector: (api) => question(api),
};

const TYPE: FormTourStep = opensFrom<FormTourApi, FormTourStep>(
  {
    id: 'type',
    title: 'Any Kind of Answer',
    body: 'Short or long text, single or multiple choice, a rating, an email, a number, a date, a link or a checkbox.',
    prepare: (api) => api.editQuestion(),
    selector: (api) => question(api, ' button[aria-haspopup="listbox"]'),
  },
  (api) => question(api, ' button[aria-haspopup="listbox"]'),
);

// The form as a respondent sees it, ringed on the example question (FormFill draws it as #form-q-<id>), not the whole
// page: one question to try, with what to do and how to come back.
const PREVIEW: FormTourStep = {
  id: 'preview',
  title: 'Try It as They Will',
  body: 'This is Preview: your form exactly as people will fill it in. Type an answer to our question to try it. Back to Editing, at the top, takes you back.',
  prepare: (api) => api.preview(true),
  cleanup: (api) => api.preview(false),
  selector: (api) => {
    const id = api.questionId();
    // A form part id is letters, digits and dashes (newFormPartId): safe in a selector as it is.
    return id ? `#form-q-${id}` : null;
  },
};

const SETTINGS: FormTourStep = opensFrom(
  {
    id: 'settings',
    title: 'Where Responses Go',
    body: 'The cog sets where responses go (a board or a sheet), how they are filed, and when the form closes.',
    selector: () => '[aria-label="Form Settings"]',
  },
  () => '[aria-label="Form Settings"]',
);

const DESTINATION = (kind: 'board' | 'sheet'): FormTourStep => ({
  id: 'destination',
  title: kind === 'sheet' ? 'Responses Land Here' : 'Responses Arrive Here',
  body:
    kind === 'sheet'
      ? 'Each response becomes a row on this sheet, as it comes in.'
      : 'Each response becomes a card on this board, as it comes in.',
  selector: () => (kind === 'sheet' ? '[data-plan-sheet]' : '[data-plan-board]'),
  prepare: (api) => {
    const to = api.destination();
    if (to) api.openTab(to.tabId);
  },
  cleanup: (api) => api.backToForm(),
});

const SHARE: FormTourStep = opensFrom(
  {
    id: 'share',
    title: 'Share It',
    body: 'Publish for a link anyone can fill in. They see only the form, never your plan.',
    target: 'share-form',
    mobileSkip: true,
  },
  () => '[data-tour-id="share-form"]',
  { modal: true },
);

const OUTRO: FormTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Your Form',
  body: 'Our example question goes when you finish. Run this again from the cog › Show Me Around.',
};

export function formTourSteps({
  destination,
}: {
  destination: 'board' | 'sheet' | null;
}): FormTourStep[] {
  return [
    ADD,
    EDIT,
    TYPE,
    PREVIEW,
    SETTINGS,
    ...(destination ? [DESTINATION(destination)] : []),
    SHARE,
    OUTRO,
  ];
}

export const formTourStepTelemetryType = (id: string) => stepTelemetryType('FormTourStep', id);
