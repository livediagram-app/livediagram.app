import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOLDER_OPTIONS,
  SPECIFIC_TAB_KINDS,
  TEMPLATE_FAMILIES,
  creationIntentOf,
  indexIntentOf,
  readCreationIntent,
} from './placement-defaults';

// Default folders (docs/specs/013-workspace/default-folders.md): the entries, generated from closed lists, and the
// creation intent a create carries.

describe('DEFAULT_FOLDER_OPTIONS', () => {
  // Work Tracker #507: the Workshop mode's entry repeated the app's own (Spaces), and the retrospectives left.
  it('has no entry beside the app’s own: no mode, no specific tab kind', () => {
    expect(DEFAULT_FOLDER_OPTIONS).toEqual([]);
    expect(SPECIFIC_TAB_KINDS).toEqual([]);
  });

  it('has no template family', () => {
    expect(TEMPLATE_FAMILIES).toEqual([]);
  });
});

describe('creationIntentOf', () => {
  it('reads a general tab as a diagram tab opening in Workshop', () => {
    expect(creationIntentOf({ kind: 'diagram' })).toEqual({ mode: 'workshop', tabKind: 'diagram' });
  });

  it('reads a tab with no kind as the general tab', () => {
    expect(creationIntentOf({})).toEqual({ mode: 'workshop', tabKind: 'diagram' });
  });

  it('reads a general tab stored in Draw mode as Workshop', () => {
    expect(creationIntentOf({ kind: 'diagram', opensIn: 'draw' })).toEqual({
      mode: 'workshop',
      tabKind: 'diagram',
    });
  });

  it('reads a legacy whiteboard tab as a general tab opening in Workshop', () => {
    expect(creationIntentOf({ kind: 'whiteboard' })).toEqual({
      mode: 'workshop',
      tabKind: 'diagram',
    });
  });

  it('reads a tab of a kind this product does not have as the general tab', () => {
    expect(creationIntentOf({ kind: 'event-storming' })).toEqual({
      mode: 'workshop',
      tabKind: 'diagram',
    });
  });

  it('carries no family for a template with none', () => {
    expect(creationIntentOf({ kind: 'diagram' }, null)).toEqual({
      mode: 'workshop',
      tabKind: 'diagram',
    });
  });

  it('reads a document with no tab as a diagram', () => {
    expect(creationIntentOf(undefined)).toEqual({ mode: 'workshop', tabKind: 'diagram' });
  });
});

describe('readCreationIntent', () => {
  it.each([[undefined], [null]])('reads %j as no intent', (value) => {
    expect(readCreationIntent(value)).toEqual({ ok: true, intent: null });
  });

  it('reads a mode alone as the general tab', () => {
    expect(readCreationIntent({ mode: 'draw' })).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('reads null tab kind and template family as absent', () => {
    expect(readCreationIntent({ mode: 'draw', tabKind: null, templateFamily: null })).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('reads every retired mode as Workshop', () => {
    for (const mode of ['diagram', 'draw', 'pages', 'illustrate', 'infographic'])
      expect(readCreationIntent({ mode })).toEqual({
        ok: true,
        intent: { mode: 'workshop', tabKind: 'diagram' },
      });
  });

  it("reads a mode by Workshop mode's old name as Workshop", () => {
    expect(readCreationIntent({ mode: 'facilitate' })).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('reads every field, and the retired retrospective family as none', () => {
    expect(
      readCreationIntent({
        mode: 'diagram',
        tabKind: 'diagram',
        templateFamily: 'retrospective',
      }),
    ).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('ignores fields beyond its three', () => {
    expect(readCreationIntent({ mode: 'diagram', boardType: 'kanban', extra: 1 })).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it.each([
    ['a string', 'mode:draw'],
    ['an array', ['diagram']],
    ['a missing mode', { templateFamily: 'mindmap' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['the legacy whiteboard kind', { mode: 'draw', tabKind: 'whiteboard' }],
    ['a kind this product does not have', { mode: 'draw', tabKind: 'event-storming' }],
    ['an unknown template family', { mode: 'diagram', templateFamily: 'mindmap' }],
    ['the retired Kanban family', { mode: 'diagram', templateFamily: 'kanban' }],
    ['a template family that is not a string', { mode: 'diagram', templateFamily: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('indexIntentOf', () => {
  it('joins the parts the intent names, mode first', () => {
    expect(indexIntentOf({ mode: 'workshop', tabKind: 'diagram' })).toBe('workshop:diagram');
  });

  it('is null for no intent', () => {
    expect(indexIntentOf(null)).toBeNull();
  });
});
