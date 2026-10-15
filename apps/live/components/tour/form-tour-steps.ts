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
  body: `Want a quick look around your form: building it, where its responses go and sharing it? ${NEVER_CHANGES}`,
};

const FORM: FormTourStep = {
  id: 'form',
  title: 'Build It Here',
  body: 'This is the form as people will see it. Click a question to change its wording, type and settings, right where it is.',
  selector: () => '[data-form-page] [data-form-question], [data-form-page] [data-form-add]',
};

const ADD: FormTourStep = {
  id: 'add',
  title: 'Add Questions',
  body: 'Add a question of the type in the button, or pick another from its arrow. Add Section starts a new page of questions.',
  selector: () => '[data-form-page] [data-form-add]',
};

const STATUS: FormTourStep = {
  id: 'status',
  title: 'Responses and Preview',
  body: 'See whether the form takes responses and how many it has had (click the count to see them). Preview fills it in as people will.',
  selector: () => '[data-form-status]',
};

const SETTINGS: FormTourStep = {
  id: 'settings',
  title: 'Where Responses Go',
  body: 'The cog chooses where each response lands, as a card on a board or a row in a sheet, and when the form closes.',
  selector: () => '[aria-label="Form Settings"]',
};

const SHARE: FormTourStep = {
  id: 'share',
  title: 'Share Form',
  body: 'Publish the form to get a link anyone can fill in. They never see your document.',
  target: 'share-form',
  mobileSkip: true,
};

const DESTINATION = (kind: 'board' | 'sheet'): FormTourStep => ({
  id: 'destination',
  title: kind === 'sheet' ? 'Responses Land Here' : 'Responses Arrive Here',
  body:
    kind === 'sheet'
      ? 'Each response becomes a row in this sheet, a column for every question.'
      : 'Each response becomes a card on this board, its answers in the card’s fields, ready to move along.',
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
  body: 'Show Me Around in the form’s cog runs this tour again whenever you want it.',
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
