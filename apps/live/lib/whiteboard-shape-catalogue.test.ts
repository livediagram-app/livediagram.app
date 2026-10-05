import { describe, expect, it } from 'vitest';
import {
  armedWhiteboardShape,
  isWhiteboardShapeKey,
  WHITEBOARD_SHAPE_CATALOGUE,
  whiteboardShapeEntry,
} from './whiteboard-shape-catalogue';
import { SHAPE_TILES } from './palette-search';

describe('the whiteboard shape catalogue', () => {
  it('opens with the Shapes flyout kinds under their dock names', () => {
    const shapes = WHITEBOARD_SHAPE_CATALOGUE.filter((e) => e.group === 'shapes').map(
      (e) => e.label,
    );
    expect(shapes.slice(0, 4)).toEqual(['Rectangle', 'Ellipse', 'Diamond', 'Cylinder']);
    expect(shapes).toContain('Parallelogram');
    expect(shapes).toContain('Bubble');
  });

  it('files Line and Arrow under Draw, as the palette files its arrow', () => {
    const draw = WHITEBOARD_SHAPE_CATALOGUE.filter((e) => e.group === 'draw').map((e) => e.key);
    expect(draw).toEqual(['line', 'arrow']);
  });

  it('offers every palette shape tile except the Components and Plan categories', () => {
    const keys = new Set(WHITEBOARD_SHAPE_CATALOGUE.map((e) => e.key));
    for (const tile of SHAPE_TILES) {
      if (tile.section === 'components' || tile.section.startsWith('plan-')) continue;
      const kind = (tile.action as { kind: string }).kind;
      const found = [...keys].some((k) => k === kind || k.startsWith(`${kind}:`));
      const docked = kind === 'square' || kind === 'circle';
      expect(found || docked, kind).toBe(true);
    }
    expect(keys.has('code-block')).toBe(false);
    expect(keys.has('checklist')).toBe(false);
    expect(keys.has('entity')).toBe(false);
    expect([...keys].some((k) => k.startsWith('plan-'))).toBe(false);
  });

  it('keys each creation choice apart, so a poll is not a timer', () => {
    expect(whiteboardShapeEntry('session-button:poll')?.label).toBe('Poll');
    expect(whiteboardShapeEntry('session-button:timer')?.label).toBe('Timer');
  });

  it('holds the sticky note as a shape, armed as a plain note', () => {
    const sticky = whiteboardShapeEntry('sticky')!;
    expect(sticky.label).toBe('Sticky note');
    expect(sticky.intent).toEqual({ type: 'sticky' });
    expect(isWhiteboardShapeKey('sticky')).toBe(true);
    // An Event Storming note (a coloured sticky) is not the whiteboard's note.
    expect(armedWhiteboardShape({ type: 'sticky', fill: '#ffb000' })).toBeNull();
  });

  it('has unique keys', () => {
    const keys = WHITEBOARD_SHAPE_CATALOGUE.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('orders its groups as the palette orders its categories', () => {
    const groups = [...new Set(WHITEBOARD_SHAPE_CATALOGUE.map((x) => x.group))];
    expect(groups).toEqual(['shapes', 'write', 'draw', 'build', 'devices', 'data', 'behaviour']);
  });

  it('arms every shape entry plain, as a board shape', () => {
    for (const e of WHITEBOARD_SHAPE_CATALOGUE.filter((x) => x.key !== 'sticky')) {
      expect((e.intent as { board?: true }).board, e.key).toBe(true);
    }
    expect(whiteboardShapeEntry('triangle')?.intent).toEqual({
      type: 'shape',
      kind: 'triangle',
      board: true,
    });
    expect(whiteboardShapeEntry('reaction-pad:hearts')?.intent).toEqual({
      type: 'shape',
      kind: 'reaction-pad',
      reaction: 'hearts',
      board: true,
    });
  });

  it('knows its own keys and nothing else', () => {
    expect(isWhiteboardShapeKey('rectangle')).toBe(true);
    expect(isWhiteboardShapeKey('square')).toBe(false);
    expect(isWhiteboardShapeKey('banner')).toBe(false);
    expect(isWhiteboardShapeKey(42)).toBe(false);
  });

  it('reads back which catalogue shape is armed', () => {
    for (const e of WHITEBOARD_SHAPE_CATALOGUE) {
      expect(armedWhiteboardShape(e.intent), e.key).toBe(e.key);
    }
    expect(armedWhiteboardShape({ type: 'shape', kind: 'triangle' })).toBeNull();
    expect(armedWhiteboardShape({ type: 'sticky' })).toBe('sticky');
    expect(armedWhiteboardShape(null)).toBeNull();
  });
});
