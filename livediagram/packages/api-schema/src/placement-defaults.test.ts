import { describe, expect, it } from 'vitest';
import { EDITOR_MODES, ES_BOARD_LAYER_ID } from '@livediagram/document';
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
  it('has one entry per editor mode, then one per specific tab kind', () => {
    expect(DEFAULT_FOLDER_OPTIONS.map((o) => `${o.dimension}:${o.value}`)).toEqual([
      ...EDITOR_MODES.map((mode) => `mode:${mode}`),
      'kind:event-storming',
    ]);
    expect(SPECIFIC_TAB_KINDS).toEqual(['event-storming']);
  });

  it('has the one template family, the retrospective', () => {
    expect(TEMPLATE_FAMILIES).toEqual(['retrospective']);
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

  it('reads Pages mode, and either of its old names, as Diagram', () => {
    for (const mode of ['pages', 'illustrate', 'infographic'])
      expect(readCreationIntent({ mode })).toEqual({
        ok: true,
        intent: { mode: 'diagram', tabKind: 'diagram' },
      });
  });

  it("reads a mode by Workshop mode's old name as Workshop", () => {
    expect(readCreationIntent({ mode: 'facilitate' })).toEqual({
      ok: true,
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('reads every field', () => {
    expect(
      readCreationIntent({ mode: 'diagram', tabKind: 'event-storming', templateFamily: 'retrospective' }),
    ).toEqual({
      ok: true,
      intent: { mode: 'diagram', tabKind: 'event-storming', templateFamily: 'retrospective' },
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
    ['a missing mode', { templateFamily: 'retrospective' }],
    ['an unknown mode', { mode: 'pixel' }],
    ['the legacy whiteboard kind', { mode: 'draw', tabKind: 'whiteboard' }],
    ['an unknown template family', { mode: 'diagram', templateFamily: 'mindmap' }],
    ['the retired Kanban family', { mode: 'diagram', templateFamily: 'kanban' }],
    ['a template family that is not a string', { mode: 'diagram', templateFamily: 3 }],
  ])('refuses %s', (_label, value) => {
    expect(readCreationIntent(value)).toEqual({ ok: false });
  });
});

describe('indexIntentOf', () => {
  it('joins the parts the intent names, mode first', () => {
    expect(indexIntentOf({ mode: 'diagram', tabKind: 'diagram' })).toBe('diagram:diagram');
    expect(
      indexIntentOf({ mode: 'draw', tabKind: 'event-storming', templateFamily: 'retrospective' }),
    ).toBe('draw:event-storming:retrospective');
  });

  it('is null for no intent', () => {
    expect(indexIntentOf(null)).toBeNull();
  });
});
