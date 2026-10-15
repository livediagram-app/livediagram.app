import { trustedHtml } from '@livediagram/ui';
import { memo, useMemo, type CSSProperties } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  sequenceDrawing,
  type ShapeElement,
} from '@livediagram/document';

/** Seconds of the Play wipe per message at Normal speed (docs/specs/009-elements/sequence-diagram.md "Animation"). */
export const SEQ_PLAY_S_PER_MESSAGE = 0.4;

/** What the picture says to a screen reader: its participants and how many messages pass between them. */
export function sequenceLabel(element: ShapeElement): string {
  const names = (element.sequenceParticipants ?? []).map((p) => p.label || p.id).join(', ');
  const n = element.sequenceMessages?.length ?? 0;
  return `Sequence diagram: ${names}; ${n} ${n === 1 ? 'message' : 'messages'}`;
}

// The sequence diagram (docs/specs/009-elements/sequence-diagram.md): the export's own picture (sequenceDrawing, the
// shared layout drawn by the headless renderer), fitted into the box with its aspect kept, so canvas and export agree.
// The markup is built by our renderer from bounded, escaped rows, never from raw input. Play wipes it in from the top.
export const SequenceFace = memo(function SequenceFace({
  element,
  paper,
}: {
  element: ShapeElement;
  paper: string;
}) {
  const html = useMemo(
    () =>
      sequenceDrawing(element, paper).replace(
        /^<svg([^>]*?) width="[^"]*" height="[^"]*"/,
        '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet"',
      ),
    // The drawing depends on the rows and the paper only.
    // oxlint-disable-next-line react/exhaustive-deps
    [element.sequenceParticipants, element.sequenceMessages, element.sequenceNumbered, paper],
  );
  const play = element.sequenceAnim === 'play';
  const messages = Math.max(1, element.sequenceMessages?.length ?? 0);
  const style = play
    ? ({
        '--lvd-seq-dur': `${
          SEQ_PLAY_S_PER_MESSAGE *
          messages *
          ANIMATION_SPEED_FACTOR[element.sequenceAnimSpeed ?? DEFAULT_ANIMATION_SPEED]
        }s`,
      } as CSSProperties)
    : undefined;
  return (
    <div
      role="img"
      aria-label={sequenceLabel(element)}
      data-sequence-picture
      className={`pointer-events-none absolute inset-0 ${
        play ? (element.sequenceAnimRepeat ? 'lvd-seq-play-loop' : 'lvd-seq-play') : ''
      }`}
      style={style}
      dangerouslySetInnerHTML={{ __html: trustedHtml(html) }}
    />
  );
});
