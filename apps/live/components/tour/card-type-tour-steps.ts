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
    body: 'Name it (a Risk, a Request) and pick a colour and glyph. Every card of this type wears them.',
    target: 'card-type-general',
    prepare: typeInto('configuration', 'card-type-general'),
    keepFocus: true,
  },
  {
    id: 'fields',
    title: 'Lay Out Its Fields',
    body: 'The fields its cards hold. Add Field adds one; drag a field to reorder it.',
    target: 'card-type-fields',
    // The engine scrolls the section to the top of the tab's scrolling panel, so a section further down
    // (Configuration's Fields, under General) is in view, read from its heading, when the ring lands on it.
    revealAt: 'start',
    prepare: on('configuration'),
  },
  {
    id: 'states',
    title: 'Choose Its States',
    body: 'Tick the states its cards can move into.',
    target: 'card-type-states',
    prepare: on('statuses'),
  },
  {
    id: 'display',
    title: 'Arrange the Card',
    body: 'Pick a size and drag fields on or off. Boards show its cards like this.',
    target: 'card-type-display',
    prepare: on('display'),
  },
  {
    id: 'save',
    title: 'Save It',
    body: 'Save it. It shows in Add a Card on your boards straight away.',
    target: 'card-type-save',
  },
  {
    id: 'outro',
    card: 'outro',
    title: 'That Is a Card Type',
    body: 'Change it any time from Edit Cards.',
  },
];
