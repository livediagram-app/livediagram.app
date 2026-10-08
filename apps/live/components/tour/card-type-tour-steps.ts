// The steps of Show Me in the card type editor (docs/specs/026-plan/item-types.md "Editing a type"): a tour of
// making a card type, run on the editor itself. Each step opens the editor tab it is about and rings a real
// control, which stays usable, so the person builds their type as the tour goes.
import type { TypeEditorTab } from '@/components/plan/ItemTypeEditorTabs';
import type { TourStepOf } from './tour-step';
import { waitForSelector } from './tour-dom';

export type CardTypeTourApi = {
  // Opens a tab of the editor (the draft is kept: switching loses nothing).
  showTab: (tab: TypeEditorTab) => void;
};

type CardTypeTourStep = TourStepOf<CardTypeTourApi>;

const on = (tab: TypeEditorTab) => (api: CardTypeTourApi) => api.showTab(tab);

// Opens the tab, then puts the caret in the step's field, so the person can type into it straight away.
const typeInto = (tab: TypeEditorTab, target: string) => async (api: CardTypeTourApi) => {
  api.showTab(tab);
  const input = await waitForSelector(`[data-tour-id="${target}"] input`, 1000);
  input?.focus();
};

export const CARD_TYPE_TOUR_STEPS: CardTypeTourStep[] = [
  {
    id: 'general',
    title: 'Name It, Then Give It a Look',
    body: 'What are these cards? A Customer Call, a Risk, a Request: type its name now, the tour waits. Its colour and glyph mark every card of this type, so they stand out on a busy board.',
    target: 'card-type-general',
    prepare: typeInto('general', 'card-type-general'),
  },
  {
    id: 'fields',
    title: 'Lay Out Its Fields',
    body: 'What its cards hold, laid out as the card panel shows them. Add Field gives it more (a Link to Card ties it to another card); drag a field to move it between tabs and Details.',
    target: 'card-type-fields',
    prepare: on('fields'),
  },
  {
    id: 'states',
    title: 'Choose Its States',
    body: 'Cards of this type only ever move into the states ticked here. The Default State is where one made off a board starts.',
    target: 'card-type-states',
    prepare: on('statuses'),
  },
  {
    id: 'display',
    title: 'Arrange the Card',
    body: 'Pick a size, then drag fields onto the example card, or off it. Boards draw its cards just like this.',
    target: 'card-type-display',
    prepare: on('display'),
  },
  {
    id: 'save',
    title: 'Save It',
    body: 'Save, and it is ready: a new type shows in Add a Card on your boards, and an edited one changes its cards at once.',
    target: 'card-type-save',
  },
  {
    id: 'outro',
    card: 'outro',
    title: 'That Is a Card Type',
    body: 'Change it any time from the Edit Cards menu.',
  },
];
