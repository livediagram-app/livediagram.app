import { describe, expect, it } from 'vitest';
import { creationIntentOf, readCreationIntent } from './placement-defaults';

// The creation intent a create carries (docs/specs/013-workspace/default-folders.md).

describe('creationIntentOf', () => {
  it('reads a tab opening in Pages', () => {
    expect(creationIntentOf({ opensIn: 'pages' })).toEqual({ mode: 'pages', tabKind: 'diagram' });
  });

  it('reads a tab that names no mode as Pages', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'pages', tabKind: 'diagram' });
  });

  it('reads a design with no tab as Pages', () => {
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
    ["livediagram's Diagram mode", { mode: 'diagram' }],
    ['an unknown tab kind', { mode: 'pages', tabKind: 'whiteboard' }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});
