// The steps of the Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): a welcome card, then the form as it is
// built, adding a question, the status bar (responses, Preview), the cog (where responses go, settings), Share Form,
// and, when the form has somewhere to send its responses, that board or sheet itself, then an outro. It changes
// nothing: its steps only point, and the one it moves for is the destination step, which opens that tab and comes back.
import { stepTelemetryType, type TourStepOf } from './tour-step';

export type FormTourApi = {
  // Where responses go: the board's or sheet's tab, null without one.
  destination: () => { tabId: string; kind: 'board' | 'sheet' } | null;
  openTab: (tabId: string) => void;
  backToForm: () => void;
};

export type FormTourStep = TourStepOf<FormTourApi>;

const NEVER_CHANGES = 'We will only point things out, never change anything.';

const WELCOME: FormTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with forms?',
  body: `A quick look at building your form, where responses go and sharing it? ${NEVER_CHANGES}`,
};

const FORM: FormTourStep = {
  id: 'form',
  title: 'Build It Here',
  body: 'This is your form as people see it. Click a question to edit it.',
  selector: () => '[data-form-page] [data-form-question], [data-form-page] [data-form-add]',
};

const ADD: FormTourStep = {
  id: 'add',
  title: 'Add Questions',
  body: 'Add a question, or pick a type from the arrow. Add Section starts a new page.',
  selector: () => '[data-form-page] [data-form-add]',
};

const STATUS: FormTourStep = {
  id: 'status',
  title: 'Responses and Preview',
  body: 'How many responses you have. Preview lets you try it out.',
  selector: () => '[data-form-status]',
};

const SETTINGS: FormTourStep = {
  id: 'settings',
  title: 'Where Responses Go',
  body: 'The cog sets where responses go (a board or a sheet) and when the form closes.',
  selector: () => '[aria-label="Form Settings"]',
};

const SHARE: FormTourStep = {
  id: 'share',
  title: 'Share Form',
  body: 'Publish to get a link anyone can fill in. They never see your document.',
  target: 'share-form',
  mobileSkip: true,
};

const DESTINATION = (kind: 'board' | 'sheet'): FormTourStep => ({
  id: 'destination',
  title: kind === 'sheet' ? 'Responses Land Here' : 'Responses Arrive Here',
  body:
    kind === 'sheet' ? 'Each response becomes a row here.' : 'Each response becomes a card here.',
  selector: () => (kind === 'sheet' ? '[data-plan-sheet]' : '[data-plan-board]'),
  prepare: (api) => {
    const to = api.destination();
    if (to) api.openTab(to.tabId);
  },
  cleanup: (api) => api.backToForm(),
});

const OUTRO: FormTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Form',
  body: 'Run this again from the cog › Show Me Around.',
};

// The steps for this form: the destination's own step only when it has one.
export function formTourSteps({
  destination,
  hasQuestions,
}: {
  destination: 'board' | 'sheet' | null;
  hasQuestions: boolean;
}): FormTourStep[] {
  return [
    WELCOME,
    ...(hasQuestions ? [FORM] : []),
    ADD,
    STATUS,
    SETTINGS,
    SHARE,
    ...(destination ? [DESTINATION(destination)] : []),
    OUTRO,
  ];
}

export const formTourStepTelemetryType = (id: string) => stepTelemetryType('FormTourStep', id);
