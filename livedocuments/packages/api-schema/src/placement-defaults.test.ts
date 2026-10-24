import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livedocuments/document';
import {
  indexIntentOf,
  CREATION_INTENT,
  PLACEMENT_DEFAULT_KEYS,
  defaultKeysFor,
  isPlacementDefaultKey,
  placementDefaultTelemetryType,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the keys, generated from the closed
// list of editor modes, the creation intent a create carries, and the keys a create tries.

describe('indexIntentOf', () => {
  it('words an intent as the index keeps it', () => {
    expect(indexIntentOf({ mode: 'pages' })).toBe('pages');
    expect(indexIntentOf(null)).toBeNull();
  });
});

describe('PLACEMENT_DEFAULT_KEYS', () => {
  it('holds the one Pages key', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual(['mode:pages']);
  });

  it('has one mode key per editor mode, in their order', () => {
    expect(PLACEMENT_DEFAULT_KEYS).toEqual(EDITOR_MODES.map((mode) => `mode:${mode}`));
  });
});

describe('isPlacementDefaultKey', () => {
  it('accepts mode:pages', () => {
    expect(isPlacementDefaultKey('mode:pages')).toBe(true);
  });

  it.each([
    ['mode:diagram'],
    ['mode:draw'],
    ['mode:plan'],
    ['template:kanban'],
    ['template:retrospective'],
    ['kind:diagram'],
    ['mode:'],
    ['pages'],
    [''],
    [3],
    [null],
  ])('refuses %j', (value) => {
    expect(isPlacementDefaultKey(value)).toBe(false);
  });
});

describe('CREATION_INTENT', () => {
  it('opens in Pages', () => {
    expect(CREATION_INTENT).toEqual({ mode: 'pages' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode', () => {
    expect(readCreationIntent({ mode: 'pages' })).toEqual({ ok: true, intent: { mode: 'pages' } });
  });

  it('ignores fields beyond the mode', () => {
    expect(readCreationIntent({ mode: 'pages', tabKind: 'diagram', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'pages' },
    });
  });

  it.each([
    ['a string', 'mode:pages'],
    ['an array', ['pages']],
    ['a missing mode', { tabKind: 'diagram' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['a livediagram mode', { mode: 'diagram' }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key', () => {
    expect(defaultKeysFor({ mode: 'pages' })).toEqual(['mode:pages']);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed value per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual(['DefaultModePages']);
  });
});
