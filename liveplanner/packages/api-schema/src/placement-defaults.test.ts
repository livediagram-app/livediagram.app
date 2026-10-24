import { describe, expect, it } from 'vitest';
import {
  indexIntentOf,
  CREATION_TAB_KINDS,
  PLACEMENT_DEFAULT_KEYS,
  TEMPLATE_FAMILIES,
  candidateKeysFor,
  creationIntentOf,
  creationTabKindOf,
  defaultKeysFor,
  isPlacementDefaultKey,
  placementDefaultTelemetryType,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the keys, generated from two closed
// lists, the creation intent a create carries, and the order a create's keys are tried in.

describe('PLACEMENT_DEFAULT_KEYS', () => {
  it('holds the three keys in the order the list shows them', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual([
      'mode:plan',
      'template:retrospective',
      'template:kanban',
    ]);
  });

  it('has one template key per template family', () => {
    expect(TEMPLATE_FAMILIES).toEqual(['retrospective', 'kanban']);
  });
});

describe('isPlacementDefaultKey', () => {
  it.each([['mode:plan'], ['template:kanban']])('accepts %s', (key) => {
    expect(isPlacementDefaultKey(key)).toBe(true);
  });

  // Another product's mode, kind or template is not a key here.
  it.each([
    ['mode:diagram'],
    ['mode:draw'],
    ['mode:pages'],
    ['mode:facilitate'],
    ['board:kanban'],
    ['kind:diagram'],
    ['kind:event-storming'],
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
  it.each([['board'], ['sheet'], ['dashboard'], ['form']] as const)(
    'names a %s tab by its kind, in Plan',
    (kind) => {
      expect(creationIntentOf({ kind })).toEqual({ mode: 'plan', tabKind: kind });
    },
  );

  it('reads a tab of no Plan kind, or no tab, as empty', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'plan', tabKind: 'empty' });
    expect(creationIntentOf({ kind: 'diagram' })).toEqual({ mode: 'plan', tabKind: 'empty' });
    expect(creationIntentOf(undefined)).toEqual({ mode: 'plan', tabKind: 'empty' });
  });

  it('carries the template family it was made from', () => {
    expect(creationIntentOf({ kind: 'board' }, 'retrospective')).toEqual({
      mode: 'plan',
      tabKind: 'board',
      templateFamily: 'retrospective',
    });
  });
});

describe('creationTabKindOf', () => {
  it('is one of the creation tab kinds', () => {
    expect(CREATION_TAB_KINDS).toEqual(['board', 'sheet', 'dashboard', 'form', 'empty']);
    expect(creationTabKindOf({ kind: 'sheet' })).toBe('sheet');
    expect(creationTabKindOf({ kind: 'whiteboard' })).toBe('empty');
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone as an empty tab', () => {
    expect(readCreationIntent({ mode: 'plan' })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'empty' },
    });
  });

  it('reads null tab kind and template family as absent', () => {
    expect(readCreationIntent({ mode: 'plan', tabKind: null, templateFamily: null })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'empty' },
    });
  });

  // liveplanner never had another mode, so livediagram's are refused like any other word.
  it.each([['diagram'], ['draw'], ['workshop'], ['pages']])('refuses the mode %s', (mode) => {
    expect(readCreationIntent({ mode })).toEqual({ ok: false });
  });

  it('reads every field', () => {
    expect(
      readCreationIntent({ mode: 'plan', tabKind: 'board', templateFamily: 'kanban' }),
    ).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'board', templateFamily: 'kanban' },
    });
  });

  it('ignores fields beyond its three', () => {
    expect(readCreationIntent({ mode: 'plan', boardType: 'kanban', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'plan', tabKind: 'empty' },
    });
  });

  it.each([
    ['a string', 'mode:plan'],
    ['an array', ['plan']],
    ['a missing mode', { templateFamily: 'kanban' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['the legacy whiteboard kind', { mode: 'plan', tabKind: 'whiteboard' }],
    ['the diagram kind liveplanner has no tab of', { mode: 'plan', tabKind: 'diagram' }],
    ['the retired event-storming kind', { mode: 'diagram', tabKind: 'event-storming' }],
    ['an unknown template family', { mode: 'plan', templateFamily: 'mindmap' }],
    ['a template family that is not a string', { mode: 'plan', templateFamily: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('indexIntentOf', () => {
  it('words an intent as the index keeps it, the template family last', () => {
    expect(indexIntentOf({ mode: 'plan', tabKind: 'board' })).toBe('plan:board');
    expect(indexIntentOf({ mode: 'plan', tabKind: 'empty', templateFamily: 'kanban' })).toBe(
      'plan:empty:kanban',
    );
    expect(indexIntentOf(null)).toBeNull();
  });
});

describe('candidateKeysFor', () => {
  it('names the template, then the mode', () => {
    expect(candidateKeysFor({ mode: 'plan', tabKind: 'board', templateFamily: 'kanban' })).toEqual([
      'template:kanban',
      'mode:plan',
    ]);
  });

  it('names the mode alone without a template', () => {
    expect(candidateKeysFor({ mode: 'plan', tabKind: 'sheet' })).toEqual(['mode:plan']);
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key of an empty tab', () => {
    expect(defaultKeysFor({ mode: 'plan', tabKind: 'empty' })).toEqual(['mode:plan']);
  });

  it('tries the template key, then the mode key, of a retrospective', () => {
    expect(
      defaultKeysFor({ mode: 'plan', tabKind: 'board', templateFamily: 'retrospective' }),
    ).toEqual(['template:retrospective', 'mode:plan']);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed value per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual([
      'DefaultModePlan',
      'DefaultTemplateRetrospective',
      'DefaultTemplateKanban',
    ]);
  });
});
