import { describe, expect, it } from 'vitest';
import { ES_BOARD_LAYER_ID } from '@liveplanner/document';
import {
  PLACEMENT_DEFAULT_KEYS,
  SPECIFIC_TAB_KINDS,
  TEMPLATE_FAMILIES,
  candidateKeysFor,
  creationIntentOf,
  defaultKeysFor,
  isPlacementDefaultKey,
  placementDefaultTelemetryType,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the keys, generated from three closed
// lists, the creation intent a create carries, and the order a create's keys are tried in.

describe('PLACEMENT_DEFAULT_KEYS', () => {
  it('holds the four keys in the order the list shows them', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual([
      'mode:plan',
      'kind:event-storming',
      'template:retrospective',
      'template:kanban',
    ]);
  });

  it('has one kind key per specific tab kind, the general tab having none', () => {
    expect(SPECIFIC_TAB_KINDS).toEqual(['event-storming']);
  });

  it('has one template key per template family', () => {
    expect(TEMPLATE_FAMILIES).toEqual(['retrospective', 'kanban']);
  });
});

describe('isPlacementDefaultKey', () => {
  it.each([['mode:plan'], ['kind:event-storming'], ['template:kanban']])('accepts %s', (key) => {
    expect(isPlacementDefaultKey(key)).toBe(true);
  });

  // A retired mode's key, stored before Plan was the only mode, is no longer in force.
  it.each([
    ['mode:diagram'],
    ['mode:draw'],
    ['mode:pages'],
    ['mode:facilitate'],
    ['board:kanban'],
    ['kind:diagram'],
    ['kind:whiteboard'],
    ['template:mindmap'],
    ['mode:'],
    ['plan'],
    [''],
    [3],
    [null],
  ])('refuses %j', (value) => {
    expect(isPlacementDefaultKey(value)).toBe(false);
  });
});

describe('creationIntentOf', () => {
  it('reads a general tab as a diagram tab in Plan', () => {
    expect(creationIntentOf({ kind: 'diagram' })).toEqual({ mode: 'plan', tabKind: 'diagram' });
  });

  it('reads a tab with no kind as the general tab', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'plan', tabKind: 'diagram' });
  });

  it('reads an event-storming tab as its kind', () => {
    expect(creationIntentOf({ kind: 'event-storming' })).toEqual({
      mode: 'plan',
      tabKind: 'event-storming',
    });
  });

  it('reads a legacy event-storming board by its layer, as the document model does', () => {
    const layers = [{ id: ES_BOARD_LAYER_ID, name: 'Event Storming' }];
    expect(creationIntentOf({ layers }).tabKind).toBe('event-storming');
  });

  it('carries the template family it was made from', () => {
    expect(creationIntentOf({ kind: 'diagram' }, 'retrospective')).toEqual({
      mode: 'plan',
      tabKind: 'diagram',
      templateFamily: 'retrospective',
    });
  });

  it('reads a document with no tab as the general tab', () => {
    expect(creationIntentOf(undefined)).toEqual({ mode: 'plan', tabKind: 'diagram' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone as the general tab', () => {
    expect(readCreationIntent({ mode: 'plan' })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'diagram' },
    });
  });

  it('reads null tab kind and template family as absent', () => {
    expect(readCreationIntent({ mode: 'plan', tabKind: null, templateFamily: null })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'diagram' },
    });
  });

  // An older client still names a retired mode.
  it.each([['diagram'], ['draw'], ['workshop'], ['pages'], ['illustrate'], ['facilitate']])(
    'reads the retired mode %s as Plan',
    (mode) => {
      expect(readCreationIntent({ mode })).toEqual({
        ok: true,
        intent: { mode: 'plan', tabKind: 'diagram' },
      });
    },
  );

  it('reads every field', () => {
    expect(
      readCreationIntent({ mode: 'plan', tabKind: 'event-storming', templateFamily: 'kanban' }),
    ).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'event-storming', templateFamily: 'kanban' },
    });
  });

  it('ignores fields beyond its three', () => {
    expect(readCreationIntent({ mode: 'plan', boardType: 'kanban', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'diagram' },
    });
  });

  it.each([
    ['a string', 'mode:plan'],
    ['an array', ['plan']],
    ['a missing mode', { templateFamily: 'kanban' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['the legacy whiteboard kind', { mode: 'plan', tabKind: 'whiteboard' }],
    ['an unknown template family', { mode: 'plan', templateFamily: 'mindmap' }],
    ['a template family that is not a string', { mode: 'plan', templateFamily: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('candidateKeysFor', () => {
  it('names the kind, then the template, then the mode', () => {
    expect(
      candidateKeysFor({ mode: 'plan', tabKind: 'event-storming', templateFamily: 'kanban' }),
    ).toEqual(['kind:event-storming', 'template:kanban', 'mode:plan']);
  });

  it('names no kind key for the general tab', () => {
    expect(candidateKeysFor({ mode: 'plan', tabKind: 'diagram' })).toEqual(['mode:plan']);
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key of a general tab', () => {
    expect(defaultKeysFor({ mode: 'plan', tabKind: 'diagram' })).toEqual(['mode:plan']);
  });

  it('tries the template key, then the mode key, of a retrospective', () => {
    expect(
      defaultKeysFor({ mode: 'plan', tabKind: 'diagram', templateFamily: 'retrospective' }),
    ).toEqual(['template:retrospective', 'mode:plan']);
  });

  it('tries the kind key, then the mode key, of an event-storming board', () => {
    expect(defaultKeysFor({ mode: 'plan', tabKind: 'event-storming' })).toEqual([
      'kind:event-storming',
      'mode:plan',
    ]);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed value per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual([
      'DefaultModePlan',
      'DefaultKindEventStorming',
      'DefaultTemplateRetrospective',
      'DefaultTemplateKanban',
    ]);
  });
});
