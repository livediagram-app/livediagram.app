import {
  isSequenceElement,
  withSequenceNumbered,
  withSequenceRows,
  type Element,
  type SequenceElementMessage,
  type SequenceElementParticipant,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';

// The sequence diagram's dialog writes (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"). Each is
// one commit, so one undo step. They name their element rather than reading the selection: the dialog edits the
// diagram it was opened for, whatever happens to the selection behind it.
export function useSequenceSetters({
  commit,
}: {
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}) {
  const on = (id: string, fn: (el: Element) => Element) =>
    commit((els) => els.map((el) => (el.id === id && isSequenceElement(el) ? fn(el) : el)));

  const setSequenceRows = (
    id: string,
    rows: { participants: SequenceElementParticipant[]; messages: SequenceElementMessage[] },
    type: 'SequenceParticipants' | 'SequenceMessages' | 'SequenceText',
  ) => {
    on(id, (el) => withSequenceRows(el, rows));
    track('Element', 'Changed', type);
  };

  const setSequenceNumbered = (id: string, numbered: boolean) => {
    on(id, (el) => withSequenceNumbered(el, numbered));
    track('Element', 'Changed', 'SequenceNumbered');
  };

  return { setSequenceRows, setSequenceNumbered };
}
