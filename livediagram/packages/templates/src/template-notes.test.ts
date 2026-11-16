// What every template shows on top of its drawing (docs/specs/008-canvas/canvas-and-palette.md "What a template
// shows"): its note on its title, and on a Workshop board that lacks them, the Timer and Vote it runs on.
import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/document';
import { buildTemplate } from './build-template';
import { TEMPLATE_CONTENT_LAYER_ID, templateLayers } from './template-layers';
import { templateEditorMode } from './template-modes';
import { templateNote } from './template-notes';
import { KIT_GAP, sessionKit, templateTitleIndex, withTemplateNote } from './template-session-kit';
import { TEMPLATES, type TemplateKind } from './templates';

const tools = (els: readonly Element[]) =>
  els.flatMap((e) =>
    e.type === 'shape' && e.shape === 'session-button' ? [e.session?.tool ?? 'timer'] : [],
  );
const kinds = TEMPLATES.map((t) => t.kind);
const BLANKS: readonly TemplateKind[] = ['blank', 'whiteboard', 'blank-session'];

describe('template notes', () => {
  it('gives every template but the blanks a note of real words, and the blanks none', () => {
    for (const kind of kinds) {
      const said = templateNote(kind);
      if (BLANKS.includes(kind)) {
        expect(said, kind).toBeNull();
        continue;
      }
      expect(said?.note.length ?? 0, kind).toBeGreaterThan(60);
      expect(said!.note, kind).not.toMatch(/lorem|ipsum|TODO|—/i);
    }
  });

  it.each(kinds.filter((k) => !BLANKS.includes(k)))('puts the %s note on its title', (kind) => {
    const els = buildTemplate(kind, 0, 0);
    expect(els.some((e) => 'note' in e && e.note === templateNote(kind)!.note)).toBe(true);
  });

  it.each(kinds.filter((k) => templateNote(k)?.kit))(
    'runs %s as a Workshop with its timer, and its vote where it has one',
    (kind) => {
      const kit = templateNote(kind)!.kit!;
      expect(templateEditorMode(kind)).toBe('workshop');
      const has = tools(buildTemplate(kind, 0, 0));
      expect(has).toContain('timer');
      if (kit.dots) expect(has).toContain('vote');
      // Never a second Timer or Vote beside the board's own.
      expect(has.filter((t) => t === 'timer')).toHaveLength(1);
      expect(has.filter((t) => t === 'vote').length).toBeLessThanOrEqual(1);
    },
  );
});

describe('templateTitleIndex', () => {
  const text = (x: number, y: number, textSize?: 'sm' | 'md' | 'lg'): Element => ({
    ...createText(x, y),
    label: 't',
    ...(textSize ? { textSize } : {}),
  });

  it('picks the largest text, then the topmost, then the leftmost', () => {
    expect(templateTitleIndex([text(0, 0, 'sm'), text(0, 50, 'lg'), text(0, 90, 'md')])).toBe(1);
    expect(templateTitleIndex([text(0, 50, 'lg'), text(0, 10, 'lg')])).toBe(1);
    expect(templateTitleIndex([text(40, 10, 'lg'), text(10, 10, 'lg')])).toBe(1);
    expect(templateTitleIndex([text(10, 10), text(40, 10)])).toBe(0);
    // An exact px size or none ranks under every preset.
    const px = { ...createText(0, 0), label: 't', textSize: 30 } as Element;
    const bare = { ...createText(0, 0), label: 't' } as Element & { textSize?: unknown };
    delete bare.textSize;
    expect(templateTitleIndex([px, text(0, 40, 'sm')])).toBe(1);
    expect(templateTitleIndex([bare, text(0, 40, 'sm')])).toBe(1);
  });

  it('falls back to the first element without a text, and to none on an empty board', () => {
    expect(templateTitleIndex([createShape('square', 0, 0)])).toBe(0);
    expect(templateTitleIndex([])).toBe(-1);
  });
});

describe('sessionKit', () => {
  const kit = { minutes: 10, timer: 'Ten minutes to write.', dots: 3, vote: 'Three dots each.' };

  it('stands right of the board, adding only the tools it lacks', () => {
    const both = sessionKit(kit, 500, 20, new Set());
    expect(both[0]).toMatchObject({ label: 'Run the session', x: 500 + KIT_GAP, y: 20 });
    expect(tools(both)).toEqual(['timer', 'vote']);
    expect(tools(sessionKit(kit, 500, 20, new Set(['timer'])))).toEqual(['vote']);
    expect(sessionKit(kit, 500, 20, new Set(['timer', 'vote']))).toEqual([]);
    expect(tools(sessionKit({ minutes: 5, timer: 'Go.' }, 0, 0, new Set()))).toEqual(['timer']);
  });
});

describe('withTemplateNote', () => {
  it('leaves a blank, an empty board and a title that has its own note as they are', () => {
    const els = [createShape('square', 0, 0)];
    expect(withTemplateNote('blank', els)).toBe(els);
    expect(withTemplateNote('swot', [])).toEqual([]);
    const own = { ...createText(0, 0), label: 'Mine', note: 'Kept' };
    expect(withTemplateNote('swot', [own])[0]).toMatchObject({ note: 'Kept' });
  });

  it('counts a session button with no tool set as the Timer it draws', () => {
    const button = { ...createShape('session-button', 0, 0), width: 100, height: 60 } as Element;
    delete (button as { session?: unknown }).session;
    const out = withTemplateNote('affinity-map', [button]);
    expect(tools(out).filter((t) => t === 'timer')).toHaveLength(1);
  });

  it('never notes an arrow', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 200, 0);
    const arrow = createPinnedArrow(a.id, 'e', b.id, 'w');
    expect(withTemplateNote('swot', [arrow, a, b])[0]).not.toHaveProperty('note');
  });

  it('puts the kit on the content layer of a layered template only', () => {
    const board = [{ ...createText(0, 0), label: 'Board', width: 300, height: 40 }];
    for (const kind of kinds.filter((k) => templateNote(k)?.kit)) {
      const out = withTemplateNote(kind, board);
      const added = out.slice(1);
      expect(added.length, kind).toBeGreaterThan(0);
      for (const el of added) {
        expect(el.layerId, kind).toBe(templateLayers(kind) ? TEMPLATE_CONTENT_LAYER_ID : undefined);
      }
    }
  });
});
