import { describe, expect, it } from 'vitest';
import { EDITOR_MODES, ES_BOARD_LAYER_ID } from '@livediagram/document';
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
  it('holds the six keys in the order the list shows them', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual([
      'mode:diagram',
      'mode:draw',
      'mode:design',
      'kind:event-storming',
      'template:retrospective',
      'template:kanban',
    ]);
  });

  it('has one mode key per editor mode, in their order', () => {
    expect(PLACEMENT_DEFAULT_KEYS.filter((k) => k.startsWith('mode:'))).toEqual(
      EDITOR_MODES.map((mode) => `mode:${mode}`),
    );
  });

  it('has one kind key per specific tab kind, the general tab having none', () => {
    expect(SPECIFIC_TAB_KINDS).toEqual(['event-storming']);
  });

  it('has one template key per template family', () => {
    expect(TEMPLATE_FAMILIES).toEqual(['retrospective', 'kanban']);
  });
});

describe('isPlacementDefaultKey', () => {
  it.each([['mode:draw'], ['kind:event-storming'], ['template:kanban']])('accepts %s', (key) => {
    expect(isPlacementDefaultKey(key)).toBe(true);
  });

  it.each([
    ['board:kanban'],
    ['kind:diagram'],
    ['kind:whiteboard'],
    ['template:mindmap'],
    ['mode:'],
    ['draw'],
    [''],
    [3],
    [null],
  ])('refuses %j', (value) => {
    expect(isPlacementDefaultKey(value)).toBe(false);
  });
});

describe('creationIntentOf', () => {
  it('reads a general tab as a diagram tab opening in Diagram mode', () => {
    expect(creationIntentOf({ kind: 'diagram' })).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });

  it('reads a tab with no kind as the general tab', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });

  it('reads a general tab opening in Draw mode', () => {
    expect(creationIntentOf({ kind: 'diagram', opensIn: 'draw' })).toEqual({
      mode: 'draw',
      tabKind: 'diagram',
    });
  });

  it('reads a legacy whiteboard tab as a general tab opening in Draw mode', () => {
    expect(creationIntentOf({ kind: 'whiteboard' })).toEqual({ mode: 'draw', tabKind: 'diagram' });
  });

  it('reads an event-storming tab as its kind, opening in Diagram mode', () => {
    expect(creationIntentOf({ kind: 'event-storming' })).toEqual({
      mode: 'diagram',
      tabKind: 'event-storming',
    });
  });

  it('reads a legacy event-storming board by its layer, as the document model does', () => {
    const layers = [{ id: ES_BOARD_LAYER_ID, name: 'Event Storming' }];
    expect(creationIntentOf({ layers }).tabKind).toBe('event-storming');
  });

  it('carries the template family it was made from', () => {
    expect(creationIntentOf({ kind: 'diagram' }, 'retrospective')).toEqual({
      mode: 'diagram',
      tabKind: 'diagram',
      templateFamily: 'retrospective',
    });
  });

  it('reads a document with no tab as a diagram', () => {
    expect(creationIntentOf(undefined)).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone as the general tab', () => {
    expect(readCreationIntent({ mode: 'draw' })).toEqual({
      ok: true,
      intent: { mode: 'draw', tabKind: 'diagram' },
    });
  });

  it('reads null tab kind and template family as absent', () => {
    expect(readCreationIntent({ mode: 'draw', tabKind: null, templateFamily: null })).toEqual({
      ok: true,
      intent: { mode: 'draw', tabKind: 'diagram' },
    });
  });

  it('reads every field', () => {
    expect(
      readCreationIntent({ mode: 'diagram', tabKind: 'event-storming', templateFamily: 'kanban' }),
    ).toEqual({
      ok: true,
      intent: { mode: 'diagram', tabKind: 'event-storming', templateFamily: 'kanban' },
    });
  });

  it('ignores fields beyond its three', () => {
    expect(readCreationIntent({ mode: 'diagram', boardType: 'kanban', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'diagram', tabKind: 'diagram' },
    });
  });

  it.each([
    ['a string', 'mode:draw'],
    ['an array', ['diagram']],
    ['a missing mode', { templateFamily: 'kanban' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['the legacy whiteboard kind', { mode: 'draw', tabKind: 'whiteboard' }],
    ['an unknown template family', { mode: 'diagram', templateFamily: 'mindmap' }],
    ['a template family that is not a string', { mode: 'diagram', templateFamily: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('candidateKeysFor', () => {
  it('names the kind, then the template, then the mode', () => {
    expect(
      candidateKeysFor({ mode: 'diagram', tabKind: 'event-storming', templateFamily: 'kanban' }),
    ).toEqual(['kind:event-storming', 'template:kanban', 'mode:diagram']);
  });

  it('names no kind key for the general tab', () => {
    expect(candidateKeysFor({ mode: 'draw', tabKind: 'diagram' })).toEqual(['mode:draw']);
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key of a diagram', () => {
    expect(defaultKeysFor({ mode: 'diagram', tabKind: 'diagram' })).toEqual(['mode:diagram']);
  });

  it('tries the template key, then the mode key, of a retrospective', () => {
    expect(
      defaultKeysFor({ mode: 'diagram', tabKind: 'diagram', templateFamily: 'retrospective' }),
    ).toEqual(['template:retrospective', 'mode:diagram']);
  });

  it('tries the kind key, then the mode key, of an event-storming board', () => {
    expect(defaultKeysFor({ mode: 'diagram', tabKind: 'event-storming' })).toEqual([
      'kind:event-storming',
      'mode:diagram',
    ]);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed value per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual([
      'DefaultModeDiagram',
      'DefaultModeDraw',
      'DefaultModeDesign',
      'DefaultKindEventStorming',
      'DefaultTemplateRetrospective',
      'DefaultTemplateKanban',
    ]);
  });
});
