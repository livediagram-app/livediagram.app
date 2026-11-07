import { describe, expect, it } from 'vitest';
import {
  PALETTE_TELEMETRY_TYPES as LIVEDIAGRAM_PALETTE_TYPES,
  apiRouteLabel as livediagramRouteLabel,
} from '@livediagram/api-schema';
import {
  isServerEmittedEvent as isLivehuddleServerEvent,
  isValidTelemetryEvent as isLivehuddleEvent,
  PALETTE_TELEMETRY_TYPES as LIVEHUDDLE_PALETTE_TYPES,
  apiRouteLabel as livehuddleRouteLabel,
} from '@livehuddle/api-schema';
import { appKey } from './env';
import { testEnv } from './test-env';
import { VOCABULARIES } from './vocabularies';

// livehuddle, registered before its launch (liveworkspace/docs/specs/008-telemetry/telemetry.md "Adding an app").
describe('livehuddle in the telemetry service', () => {
  it('has a key of its own, and none while it is unset', () => {
    expect(appKey(testEnv(), 'livehuddle.app')).toBeUndefined();
    expect(appKey(testEnv({ TELEMETRY_KEY_LIVEHUDDLE: 'huddle' }), 'livehuddle.app')).toBe(
      'huddle',
    );
    expect(
      appKey(testEnv({ TELEMETRY_KEY_LIVEDIAGRAM: 'diagram' }), 'livehuddle.app'),
    ).toBeUndefined();
  });

  it("is checked against livehuddle's own api-schema, not livediagram's", () => {
    const vocabulary = VOCABULARIES['livehuddle.app'];
    expect(vocabulary.isValid).toBe(isLivehuddleEvent);
    expect(vocabulary.isServerOnly).toBe(isLivehuddleServerEvent);
    expect(vocabulary.isValid).not.toBe(VOCABULARIES['livediagram.app'].isValid);
    expect(vocabulary.isValid({ category: 'Document', action: 'Created' })).toBe(true);
    expect(vocabulary.isValid({ category: 'Nope', action: 'Nope' })).toBe(false);
  });

  // Both are closed vocabularies that diverged when livehuddle cut Diagram mode and gained the Stage. The
  // event gate (category, action) is still the same list in both, so the difference shows in the type
  // tokens each app ranks and in the api routes each app names.
  it("has a vocabulary of its own: livehuddle's Space pieces, livediagram's AI route", () => {
    const palette = (types: Record<string, readonly string[]>) => Object.values(types).flat();
    // Only livehuddle has a Stage to place.
    expect(palette(LIVEHUDDLE_PALETTE_TYPES)).toContain('Stage');
    expect(palette(LIVEDIAGRAM_PALETTE_TYPES)).not.toContain('Stage');
    // Only livediagram has an /api/ai door; livehuddle reads it as an unknown route.
    expect(livediagramRouteLabel('POST', '/api/ai/notes')).toBe('Post.Ai');
    expect(livehuddleRouteLabel('POST', '/api/ai/notes')).toBe('Post.Unknown');
    // And the palette tokens livehuddle ranks that livediagram does not are its Space pieces: the Corridor, the
    // Stage, and the meeting, wayfinding, recreation and garden pieces only a Space holds, and a room drawn by hand
    // (CustomRoom). The palette groups them by its own categories, so the order here is not the palette's.
    const huddleOnly = palette(LIVEHUDDLE_PALETTE_TYPES).filter(
      (t) => !palette(LIVEDIAGRAM_PALETTE_TYPES).includes(t),
    );
    expect(huddleOnly.toSorted()).toEqual(
      [
        'CustomRoom',
        'Corridor',
        'Stage',
        'Office-pod',
        'Bar',
        'Bar-stool',
        'Drinks-cabinet',
        'Drinks-fridge',
        'Outdoor-plant',
        'Tree',
        'Garden-path',
        'Grass',
        'Garden-fence',
        'Door',
        'Directory',
        'Elevator',
        'Stairs',
        'Screen',
        'Room-sign',
        'Notice-board',
        'World-clock',
        'Jukebox',
        'Ping-pong-table',
        'Arcade-machine',
        'Fireplace',
        'Campfire',
        'Bench',
        'Picnic-table',
        'Hammock',
        'Garden-umbrella',
        'Fountain',
        'Pond',
        'Pool-table',
        'Foosball-table',
        'Dartboard',
        'Vending-machine',
        'Bean-bag',
        'Reading-nook',
        'Printer',
        'Copier',
        'Lockers',
        'Coat-rack',
        'Umbrella-stand',
        'Kitchen-counter',
        'Kitchen-sink',
        'Fridge',
        'Microwave',
        'Kettle',
        'Toilet-cubicle',
        'Washbasin',
        'Hand-dryer',
        'Pillar',
        'Column',
        'Car-park',
        'Bike-rack',
        'Swimming-pool',
        'Stage-curtains',
        'Podium',
        'Nap-pod',
        'Treadmill',
        'Weight-bench',
        'Phone-booth',
        'Standing-desk',
        'Hot-desk',
        'Pet-bed',
        'Reception-desk',
        'Calendar-wall',
        'Suggestion-box',
        'Signpost',
        'Photo-wall',
        'Timer',
        'Stopwatch',
      ].toSorted(),
    );
  });
});
