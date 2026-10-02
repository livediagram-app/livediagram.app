import { describe, expect, it } from 'vitest';
import { parseStyle, shapeName } from './style';

describe('parseStyle', () => {
  it('splits key/value pairs and named styles', () => {
    const s = parseStyle('ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;', false);
    expect(s.names).toEqual(['ellipse']);
    expect(s.str('fillColor')).toBe('#dae8fc');
    expect(s.flag('html')).toBe(true);
    expect(s.has('ellipse')).toBe(true);
  });

  it('splits a value at the first equals sign only', () => {
    const s = parseStyle('image=data:image/png,abc=;', false);
    expect(s.str('image')).toBe('data:image/png,abc=');
  });

  it('merges built-in named styles under the explicit pairs', () => {
    const s = parseStyle('text;align=center;', false);
    expect(s.str('fillColor')).toBe('none');
    expect(s.str('strokeColor')).toBe('none');
    expect(s.str('align')).toBe('center');
    expect(s.str('verticalAlign')).toBe('top');
  });

  it('gives a swimlane its start size and bold title', () => {
    const s = parseStyle('swimlane;html=1;', false);
    expect(s.num('startSize')).toBe(23);
    expect(s.num('fontStyle')).toBe(1);
    expect(s.str('shape')).toBe('swimlane');
  });

  it('defaults vertices to 12 px text and edges to a classic end at 11 px', () => {
    expect(parseStyle('', false).num('fontSize')).toBe(12);
    const edge = parseStyle('html=1;', true);
    expect(edge.str('endArrow')).toBe('classic');
    expect(edge.num('fontSize')).toBe(11);
    expect(parseStyle('endArrow=none;', true).str('endArrow')).toBe('none');
  });

  it('reads numbers and flags defensively', () => {
    const s = parseStyle('opacity=abc;rounded=true;dashed=0;strokeWidth=2.5;', false);
    expect(s.num('opacity')).toBeUndefined();
    expect(s.flag('rounded')).toBe(true);
    expect(s.flag('dashed')).toBe(false);
    expect(s.num('strokeWidth')).toBe(2.5);
    expect(s.num('missing')).toBeUndefined();
  });

  it('tolerates empty and malformed tokens', () => {
    const s = parseStyle(';;=x;rounded=1;', false);
    expect(s.flag('rounded')).toBe(true);
    expect(s.names).toEqual([]);
  });
});

describe('shapeName', () => {
  it('prefers shape=', () => {
    expect(shapeName(parseStyle('ellipse;shape=cloud;', false))).toBe('cloud');
  });

  it('falls back to the first named style that is a shape', () => {
    expect(shapeName(parseStyle('rhombus;html=1;', false))).toBe('rhombus');
    expect(shapeName(parseStyle('text;html=1;', false))).toBe('');
    expect(shapeName(parseStyle('label;html=1;', false))).toBe('');
  });

  it('is empty for a plain rectangle', () => {
    expect(shapeName(parseStyle('rounded=0;whiteSpace=wrap;html=1;', false))).toBe('');
  });
});
