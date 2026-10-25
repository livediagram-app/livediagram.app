import { describe, expect, it } from 'vitest';
import { placementDefaultKeysFor } from './constants';

describe('placementDefaultKeysFor', () => {
  it('tries the kind, the template, the mode, then the app', () => {
    expect(placementDefaultKeysFor('livediagram', 'workshop:event-storming:retrospective')).toEqual(
      [
        'livediagram:kind:event-storming',
        'livediagram:template:retrospective',
        'livediagram:mode:workshop',
        'livediagram',
      ],
    );
    expect(placementDefaultKeysFor('livediagram', 'draw:diagram')).toEqual([
      'livediagram:kind:diagram',
      'livediagram:mode:draw',
      'livediagram',
    ]);
  });

  it('reads one word as a template family, and no intent as the app alone', () => {
    expect(placementDefaultKeysFor('liveplanner', 'kanban')).toEqual([
      'liveplanner:template:kanban',
      'liveplanner',
    ]);
    expect(placementDefaultKeysFor('liveplanner', null)).toEqual(['liveplanner']);
    // A part that is not a plain word names no key.
    expect(placementDefaultKeysFor('liveplanner', 'plan:bo ard:')).toEqual([
      'liveplanner:mode:plan',
      'liveplanner',
    ]);
  });
});
