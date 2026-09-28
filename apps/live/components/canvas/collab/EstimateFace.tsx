// The face of an Estimate card (docs/specs/012-collaboration/estimate-card.md): planning poker. Everyone picks
// from the scale's cards, the card shows WHO has answered as face-down cards
// but not what, and one Reveal turns every card face up with the spread called
// out. Built in the behaviour elements' current look ("The look").

import {
  estimateScalePending,
  estimateValues,
  responseOf,
  type EstimateScale,
  type ShapeElement,
} from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { CollabPanel } from './collab-chrome';
import { CollabAccentScope } from './collab-accent';
import { EstimateEmpty } from './estimate/EstimateEmpty';
import { EstimatePicks } from './estimate/EstimatePicks';
import { EstimateScalePicker } from './estimate/EstimateScalePicker';
import { EstimateTable } from './estimate/EstimateTable';
import { AccentBar, EyeGlyph, ReopenGlyph } from './qa/qa-parts';

export function EstimateFace({
  element,
  label,
  textColor,
  surface,
  selfKey,
  participants,
  onRespond,
  onSetRevealed,
  onClear,
  onChooseScale,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The card's own fill, for the accent scope.
  surface: string;
  // How WE are recorded on this card: see CollabApi.selfKey.
  selfKey: string;
  // The room, so an answer can be shown under the person who gave it.
  participants: Participant[];
  // Cast or withdraw my own pick. Absent on a surface that can't write
  // (a view-role visitor, the read-only embed), which renders the cards inert.
  onRespond?: (value: string) => void;
  onSetRevealed?: (revealed: boolean) => void;
  onClear?: () => void;
  // Sets a new card's scale from the chooser it shows until one is picked.
  onChooseScale?: (scale: EstimateScale) => void;
}) {
  const responses = element.responses ?? [];
  const revealed = element.responsesRevealed === true;
  const inRoom = Math.max(participants.length, responses.length);
  // A card the palette placed without a scale asks for one first
  // (docs/specs/012-collaboration/estimate-card.md "Choosing a scale").
  const choosing = estimateScalePending(element);

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        title={label.trim() || 'Estimate'}
        textColor={textColor}
        aside={responses.length ? `${responses.length}/${inRoom} answered` : undefined}
        // The one action sits at the foot, under the cards it acts on.
        footer={
          <>
            {!revealed && onSetRevealed && responses.length > 0 ? (
              <AccentBar
                onPress={() => onSetRevealed(true)}
                icon={<EyeGlyph />}
                hoverCard={{
                  title: 'Reveal every answer',
                  description:
                    'Turns every card face up for everyone at once. You can reveal before the whole room has answered.',
                }}
                count={responses.length}
              >
                Reveal
              </AccentBar>
            ) : null}
            {revealed && onClear ? (
              <AccentBar
                onPress={onClear}
                icon={<ReopenGlyph />}
                hoverCard={{
                  title: 'Start a new round',
                  description:
                    'Clears every answer and turns the card face down for the next story.',
                }}
              >
                New round
              </AccentBar>
            ) : null}
          </>
        }
      >
        {choosing ? (
          <EstimateScalePicker textColor={textColor} onChoose={onChooseScale} />
        ) : (
          <>
            <EstimatePicks
              values={estimateValues(element.estimateScale)}
              mine={responseOf(responses, selfKey)}
              textColor={textColor}
              onRespond={onRespond}
            />
            {/* Fills the room under the cards and centres what it holds. */}
            <div className="flex min-h-0 flex-1 flex-col justify-center">
              {responses.length === 0 ? (
                <EstimateEmpty textColor={textColor} canPick={!!onRespond} />
              ) : (
                <EstimateTable
                  scale={element.estimateScale}
                  responses={responses}
                  revealed={revealed}
                  inRoom={inRoom}
                  participants={participants}
                  textColor={textColor}
                />
              )}
            </div>
          </>
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}
