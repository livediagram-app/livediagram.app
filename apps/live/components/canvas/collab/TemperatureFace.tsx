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
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  selfKey: string;
  onRespond?: (value: string) => void;
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
