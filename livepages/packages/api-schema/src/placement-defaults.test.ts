import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livepages/document';
import {
  PLACEMENT_DEFAULT_KEYS,
  creationIntentOf,
  defaultKeysFor,
  isPlacementDefaultKey,
  legacyPlacementDefaultKeys,
  parsePlacementDefaultKey,
  placementDefaultTelemetryType,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the keys, generated from the closed
// list of editor modes, the creation intent a create carries, and the keys a create tries.

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

describe('creationIntentOf', () => {
  it('reads a tab opening in Pages', () => {
    expect(creationIntentOf({ opensIn: 'pages' })).toEqual({ mode: 'pages', tabKind: 'diagram' });
  });

  it('reads a tab that names no mode as Pages', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'pages', tabKind: 'diagram' });
  });

  it('reads a document with no tab as Pages', () => {
    expect(creationIntentOf(undefined)).toEqual({ mode: 'pages', tabKind: 'diagram' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone as the general tab', () => {
    expect(readCreationIntent({ mode: 'pages' })).toEqual({
      ok: true,
      intent: { mode: 'pages', tabKind: 'diagram' },
    });
  });

  it('reads a null tab kind as absent', () => {
    expect(readCreationIntent({ mode: 'pages', tabKind: null })).toEqual({
      ok: true,
      intent: { mode: 'pages', tabKind: 'diagram' },
    });
  });

  it("reads Pages mode's old names, and livediagram's other modes, as Pages", () => {
    for (const mode of ['illustrate', 'infographic', 'diagram', 'plan'])
      expect(readCreationIntent({ mode })).toEqual({
        ok: true,
        intent: { mode: 'pages', tabKind: 'diagram' },
      });
  });

  it('ignores fields beyond its two', () => {
    expect(readCreationIntent({ mode: 'pages', templateFamily: 'kanban', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'pages', tabKind: 'diagram' },
    });
  });

  it.each([
    ['a string', 'mode:pages'],
    ['an array', ['pages']],
    ['a missing mode', { tabKind: 'diagram' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['an unknown tab kind', { mode: 'pages', tabKind: 'whiteboard' }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('parsePlacementDefaultKey', () => {
  it("reads a key stored under either of Pages mode's old names as today's", () => {
    expect(parsePlacementDefaultKey('mode:illustrate')).toBe('mode:pages');
    expect(parsePlacementDefaultKey('mode:infographic')).toBe('mode:pages');
    expect(parsePlacementDefaultKey('mode:pages')).toBe('mode:pages');
    expect(parsePlacementDefaultKey('mode:pixel')).toBeNull();
    expect(parsePlacementDefaultKey('template:kanban')).toBeNull();
  });

  it('clears every old name with the key', () => {
    expect(legacyPlacementDefaultKeys('mode:pages').sort()).toEqual([
      'mode:illustrate',
      'mode:infographic',
    ]);
  });
});

describe('defaultKeysFor', () => {
  it('tries the mode key', () => {
    expect(defaultKeysFor({ mode: 'pages', tabKind: 'diagram' })).toEqual(['mode:pages']);
  });
});

describe('placementDefaultTelemetryType', () => {
  it('names one closed value per key', () => {
    expect(PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType)).toEqual(['DefaultModePages']);
  });
});
