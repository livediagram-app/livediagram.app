import { describe, expect, it } from 'vitest';
import { indexIntentOf, CREATION_INTENT, readCreationIntent } from './placement-defaults';

// The creation intent a create carries (docs/specs/013-workspace/default-folders.md), and the word the index keeps.

describe('indexIntentOf', () => {
  it('words an intent as the index keeps it', () => {
    expect(indexIntentOf({ mode: 'pages' })).toBe('pages');
    expect(indexIntentOf(null)).toBeNull();
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
