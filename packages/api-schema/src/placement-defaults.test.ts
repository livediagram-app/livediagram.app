import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livediagram/document';
import {
  PLACEMENT_DEFAULT_KEYS,
  candidateKeysFor,
  creationIntentOf,
  defaultKeysFor,
  isPlacementDefaultKey,
  placementDefaultTelemetryType,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the keys in force, the creation
// intent a create carries, and the order a create's keys are tried in.

describe('PLACEMENT_DEFAULT_KEYS', () => {
  it('has one mode key per editor mode, in their order', () => {
    expect(PLACEMENT_DEFAULT_KEYS.filter((k) => k.startsWith('mode:'))).toEqual(
      EDITOR_MODES.map((mode) => `mode:${mode}`),
    );
  });

  it('holds the mode keys and the board keys, in the order the list shows them', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual([
      'mode:diagram',
      'mode:draw',
      'board:event-storming',
      'board:retrospective',
      'board:kanban',
    ]);
  });
});

describe('isPlacementDefaultKey', () => {
  it.each([['mode:draw'], ['board:kanban']])('accepts %s', (key) => {
    expect(isPlacementDefaultKey(key)).toBe(true);
  });

  it.each([['kind:event-storming'], ['board:mindmap'], ['mode:'], ['draw'], [''], [3], [null]])(
    'refuses %j',
    (value) => {
      expect(isPlacementDefaultKey(value)).toBe(false);
    },
  );
});

describe('creationIntentOf', () => {
  it('reads a general tab as a diagram with no board type', () => {
    expect(creationIntentOf({ kind: 'diagram' })).toEqual({ mode: 'diagram' });
  });

  it('reads a tab with no kind as the general tab', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'diagram' });
  });

  it('reads a general tab opening in Draw mode as draw', () => {
    expect(creationIntentOf({ kind: 'diagram', opensIn: 'draw' })).toEqual({ mode: 'draw' });
  });

  it('reads a legacy whiteboard tab as draw', () => {
    expect(creationIntentOf({ kind: 'whiteboard' })).toEqual({ mode: 'draw' });
  });

  it('reads an event-storming tab as an event-storming board in Diagram mode', () => {
    expect(creationIntentOf({ kind: 'event-storming' })).toEqual({
      mode: 'diagram',
      boardType: 'event-storming',
    });
  });

  it('carries the board type of the template it was made from', () => {
    expect(creationIntentOf({ kind: 'diagram' }, 'retrospective')).toEqual({
      mode: 'diagram',
      boardType: 'retrospective',
    });
  });

  it("lets an event-storming tab's kind name the board whatever the template says", () => {
    expect(creationIntentOf({ kind: 'event-storming' }, 'kanban')).toEqual({
      mode: 'diagram',
      boardType: 'event-storming',
    });
  });

  it('reads a document with no tab as a diagram', () => {
    expect(creationIntentOf(undefined)).toEqual({ mode: 'diagram' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone', () => {
    expect(readCreationIntent({ mode: 'draw' })).toEqual({ ok: true, intent: { mode: 'draw' } });
  });

  it('reads a null board type as none', () => {
    expect(readCreationIntent({ mode: 'draw', boardType: null })).toEqual({
      ok: true,
      intent: { mode: 'draw' },
    });
  });

  it('reads a mode and a board type', () => {
    expect(readCreationIntent({ mode: 'diagram', boardType: 'kanban' })).toEqual({
      ok: true,
      intent: { mode: 'diagram', boardType: 'kanban' },
    });
  });

  it('ignores fields beyond mode and board type', () => {
    expect(readCreationIntent({ mode: 'diagram', kind: 'x', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'diagram' },
    });
  });

  it.each([
    ['a string', 'mode:draw'],
    ['an array', ['diagram']],
    ['a missing mode', { boardType: 'kanban' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['an unknown board type', { mode: 'diagram', boardType: 'mindmap' }],
    ['a board type that is not a string', { mode: 'diagram', boardType: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('candidateKeysFor', () => {
  it('names the board key before the mode key, most specific first', () => {
    expect(candidateKeysFor({ mode: 'diagram', boardType: 'retrospective' })).toEqual([
      'board:retrospective',
      'mode:diagram',
    ]);
  });

  it('names only the mode key without a board type', () => {
    expect(candidateKeysFor({ mode: 'draw' })).toEqual(['mode:draw']);
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key of a diagram', () => {
    expect(defaultKeysFor({ mode: 'diagram' })).toEqual(['mode:diagram']);
  });

  it('tries the mode key of a drawing', () => {
    expect(defaultKeysFor({ mode: 'draw' })).toEqual(['mode:draw']);
  });

  it('tries the board key, then the mode key, of a board', () => {
    expect(defaultKeysFor({ mode: 'diagram', boardType: 'event-storming' })).toEqual([
      'board:event-storming',
      'mode:diagram',
    ]);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed type per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual([
      'DefaultModeDiagram',
      'DefaultModeDraw',
      'DefaultBoardEventStorming',
      'DefaultBoardRetrospective',
      'DefaultBoardKanban',
    ]);
  });
});
