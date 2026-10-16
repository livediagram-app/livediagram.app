import { conceptOutro, inTheMenu, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { waitForSelector } from './tour-dom';
import type { TourStepOf } from './tour-step';
import { TARGET_WAIT_MS } from './useTourEngine';
import { elementSelector } from '@/lib/canvas-selectors';

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
      'Each participant has a lifeline; each message is a row, top to bottom. A call that gets a reply shows a bar while it is busy.',
      elementSelector(id),
    ),
    ...(ctx.hasMore
      ? [
          {
            ...inTheMenu(
              'menu',
              'The Sequence Menu',
              'Under Sequence: Edit Sequence, and Numbered. Under Animation, Play reveals it top to bottom, a message at a time.',
            ),
            prepare: (api: ElementTourApi) => api.closeSequence(),
          },
        ]
      : []),
    onCanvas(
      'write',
      'Write It as a List',
      `${ctx.touch ? 'Double-tap' : 'Double-click'} the diagram to write it: a row a message, and it lays itself out. Next opens it for you.`,
      elementSelector(id),
    ),
    inDialog(
      'participants',
      'The Participants',
      `Left to right, as drawn. ${click} one to rename it, make it an actor, move it, or remove it with its messages.`,
      'sequence-participants',
      'messages',
    ),
    inDialog(
      'messages',
      'A Row a Message',
      ctx.touch
        ? 'From, To and the words, top to bottom. The arrows move a message up or down.'
        : 'From, To and the words, top to bottom. Enter in the words adds the next message, from whoever was called; Backspace in an empty one removes it.',
      'sequence-messages',
      'messages',
    ),
    ...(ctx.hasMessages
      ? [
          inDialog(
            'kind',
            'Call, Async or Reply',
            `${click} the arrow to change it: a call is solid, async has an open head, a reply is dashed. A call answered by a reply opens a bar.`,
            'sequence-kind',
            'messages',
          ),
        ]
      : []),
    inDialog(
      'add',
      'Add a Message',
      'Adds one after the last, from whoever was last called, up to sixty.',
      'sequence-add-message',
      'messages',
    ),
    {
      ...inDialog(
        'text',
        'Or Type It',
        'One line each: Browser -> API: Get page. Use ~> for async and --> for a reply. Mermaid-style arrows read too.',
        'sequence-text',
        'text',
      ),
      // Back to the rows on leaving, so the rest of the tour and the dialog after it read as before.
      cleanup: (api) => api.showSequenceTab('messages'),
    },
    inDialog(
      'preview',
      'Live Preview',
      'Redraws from what you write, before it is stored.',
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
      'Every change is one undo step. Done closes the dialog with the tour.',
    ),
  ];
}
