// The face of a Temperature check (docs/specs/012-collaboration/temperature-check.md): fist-of-five as five
// faces to pick from, the room's spread as bars, and its average on a mood
// meter. Built in the behaviour elements' current look ("The face"): flat,
// no printed instrument, motion that says something happened.
//
// Deliberately never hidden, the opposite choice from the estimate card:
// watching the bars move as people answer IS the reading, and it shows a
// dissenter they are not alone before they have to say so out loud.

import {
  TEMPERATURE_VALUES,
  responseOf,
  responseStats,
  responseTally,
  type ShapeElement,
} from '@livediagram/document';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';
import { CollabPanel } from './collab-chrome';
import { MoodBars } from './temperature/MoodBars';
import { MoodButtons } from './temperature/MoodButtons';
import { MoodMeter } from './temperature/MoodMeter';

export function TemperatureFace({
  element,
  label,
  textColor,
  selfKey,
  onRespond,
  onClear,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  selfKey: string;
  onRespond?: (value: string) => void;
  // Clear everyone's answer for the next reading, as the Done check resets.
  // Absent for anyone who may not run the room.
  onClear?: () => void;
  /** The way out of the round controls to the element's full menu (docs/specs/008-canvas/canvas-and-palette.md). */
  onOpenSettings?: () => void;
}) {
  const responses = element.responses ?? [];
  const stats = responseStats(responses);
  const tally = responseTally(responses, TEMPERATURE_VALUES);

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'How are we feeling?'}
      textColor={textColor}
      aside={stats.count ? `${stats.count} answered` : undefined}
      // Its own `…` only while there are answers to reset; otherwise the
      // shared settings button stands there as on every other card.
      headerExtra={
        onClear && responses.length > 0 ? (
          <ElementEllipsisMenu
            kind="command"
            label="Temperature check options"
            color={textColor}
            align="left"
          >
            {(close) => (
              <>
                <ElementMenuItem
                  onPress={() => {
                    onClear();
                    close();
                  }}
                >
                  Reset Answers
                </ElementMenuItem>
                {onOpenSettings ? (
                  <ElementMenuSettingsRow
                    onOpen={() => {
                      onOpenSettings();
                      close();
                    }}
                  />
                ) : null}
              </>
            )}
          </ElementEllipsisMenu>
        ) : undefined
      }
    >
      <MoodButtons
        mine={responseOf(responses, selfKey)}
        textColor={textColor}
        onRespond={onRespond}
      />
      <MoodBars tally={tally} textColor={textColor} />
      <MoodMeter
        average={stats.average}
        count={stats.count}
        textColor={textColor}
        canRespond={!!onRespond}
      />
    </CollabPanel>
  );
}
