import { conceptOutro, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { waitForSelector } from './tour-dom';
import type { TourStepOf } from './tour-step';
import { TARGET_WAIT_MS } from './useTourEngine';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Sequence tour (docs/specs/007-editor/element-tours.md "The Sequence tour"), on a selected sequence diagram: how it
// reads on the canvas, then its Sequence dialog, opened by the tour, where every step rings a real control: the
// participants, the messages, a message's kind, Add Message, the Text tab, the preview and Numbered. Done closes the
// dialog with the tour.

type Step = TourStepOf<ElementTourApi>;

export type SequenceTourContext = {
  elementId: string;
  hasMore: boolean;
  touch: boolean;
  // The diagram has a message, so the first message's kind button is there to point at.
  hasMessages: boolean;
};

// A step inside the Sequence dialog: opens it (again, if it was closed) on the tab the step is about; the engine
// waits for its control and scrolls it into view.
function inDialog(
  id: string,
  title: string,
  body: string,
  target: string,
  tab: 'messages' | 'text',
): Step {
  return {
    id,
    title,
    body,
    target,
    layer: 'modal',
    prepare: async (api) => {
      api.openSequence();
      await waitForSelector('[data-tour-id="sequence-preview"]', TARGET_WAIT_MS);
      // A control below the dialog's fold (a phone's sheet) is scrolled into view by the engine.
      api.showSequenceTab(tab);
    },
  };
}

// A step on the canvas: the dialog put away (a Back from it).
function onCanvas(id: string, title: string, body: string, selector: string): Step {
  return { ...onGraphic(id, title, body, selector), prepare: (api) => api.closeSequence() };
}

export function sequenceTourSteps(ctx: SequenceTourContext): Step[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onCanvas(
      'diagram',
      'Who Calls Whom',
      'Each participant has a line down; each message is a row, top to bottom.',
      elementSelector(id),
    ),
    ...(ctx.hasMore
      ? [
          {
            ...inTheMenu(
              'menu',
              'The Sequence Menu',
              'In its menu, Sequence edits it or numbers the messages.',
              ['Tools', 'Sequence'],
            ),
            prepare: (api: ElementTourApi) => api.closeSequence(),
          },
        ]
      : []),
    onCanvas(
      'write',
      'Write It as a List',
      `${ctx.touch ? 'Double-tap' : 'Double-click'} it to write the messages. Next opens it for you.`,
      elementSelector(id),
    ),
    inDialog(
      'participants',
      'The Participants',
      `${click} a participant to rename, move or remove it.`,
      'sequence-participants',
      'messages',
    ),
    inDialog(
      'messages',
      'A Row a Message',
      ctx.touch
        ? 'Each message: from, to and the words. The arrows reorder them.'
        : 'Each message: from, to and the words. Enter adds the next one.',
      'sequence-messages',
      'messages',
    ),
    ...(ctx.hasMessages
      ? [
          inDialog(
            'kind',
            'Call, Async or Reply',
            `${click} the arrow to switch between call, async and reply.`,
            'sequence-kind',
            'messages',
          ),
        ]
      : []),
    inDialog('add', 'Add a Message', 'Adds the next message.', 'sequence-add-message', 'messages'),
    {
      ...inDialog(
        'text',
        'Or Type It',
        'Or write it as text: Browser -> API: Get page.',
        'sequence-text',
        'text',
      ),
      // Back to the rows on leaving, so the rest of the tour and the dialog after it read as before.
      cleanup: (api) => api.showSequenceTab('messages'),
    },
    inDialog(
      'preview',
      'Live Preview',
      'A live preview as you write.',
      'sequence-preview',
      'messages',
    ),
    inDialog(
      'numbered',
      'Number Them',
      "Numbered puts each message's number before its words: 1: Place order.",
      'sequence-numbered',
      'messages',
    ),
    conceptOutro(
      'That Is a Sequence Diagram',
      'Undo takes back any change. Done closes the dialog.',
    ),
  ];
}
