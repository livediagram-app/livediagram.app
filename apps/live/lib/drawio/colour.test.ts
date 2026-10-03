import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { hexFill, hexInk, readColour, readFill, readInk } from './colour';

describe('readColour', () => {
  it('keeps hex colours, lower-cased', () => {
    expect(readColour('#DAE8FC')).toEqual({ kind: 'hex', value: '#dae8fc' });
    expect(readColour('#abc')).toEqual({ kind: 'hex', value: '#abc' });
    expect(readColour('#11223344')).toEqual({ kind: 'hex', value: '#11223344' });
  });

  it('reads none', () => {
    expect(readColour('none')).toEqual({ kind: 'none' });
  });

  it('leaves default, inherit and absent unset', () => {
    expect(readColour(undefined)).toEqual({ kind: 'unset' });
    expect(readColour('')).toEqual({ kind: 'unset' });
    expect(readColour('default')).toEqual({ kind: 'unset' });
    expect(readColour('inherit')).toEqual({ kind: 'unset' });
  });

  it('takes the light half of light-dark()', () => {
    expect(readColour('light-dark(#FF0000, #00ff00)')).toEqual({ kind: 'hex', value: '#ff0000' });
  });

  it('converts rgb() and rgba() to hex', () => {
    expect(readColour('rgb(255, 0, 16)')).toEqual({ kind: 'hex', value: '#ff0010' });
    expect(readColour('rgba(0,0,0,0.5)')).toEqual({ kind: 'hex', value: '#000000' });
  });

  it('leaves anything else unset', () => {
    expect(readColour('swimlane')).toEqual({ kind: 'unset' });
    expect(readColour('#zzzzzz')).toEqual({ kind: 'unset' });
    expect(readColour('red')).toEqual({ kind: 'unset' });
  });
});

describe('readColour on hostile values', () => {
  it('reads a light-dark() with no comma in linear time', () => {
    let read: ReturnType<typeof readColour> | undefined;
    const spent = cpuMsOf(() => {
      read = readColour(`light-dark(a${' '.repeat(100_000)}`);
    });
    expect(read).toEqual(readColour(undefined));
    expect(spent).toBeLessThan(20);
  });

  it('still reads light-dark() with spaces around its first colour', () => {
    expect(readColour('light-dark(  #112233  , #ffffff)')).toEqual({
      kind: 'hex',
      value: '#112233',
    });
  });
});

describe('paper colours (spec "Paper colours follow the theme too")', () => {
  it('leaves near-black ink unset, so it takes the theme ink', () => {
    expect(readInk('#000000')).toEqual({ kind: 'unset' });
    expect(readInk('#333333')).toEqual({ kind: 'unset' });
    expect(readInk('#1e1e1e')).toEqual({ kind: 'unset' });
  });

  it('keeps greys and colours as ink', () => {
    expect(readInk('#5e5e5e')).toEqual({ kind: 'hex', value: '#5e5e5e' });
    expect(readInk('#b85450')).toEqual({ kind: 'hex', value: '#b85450' });
    expect(readInk('none')).toEqual({ kind: 'none' });
  });

  it('leaves near-white fills unset, so they take the theme surface', () => {
    expect(readFill('#ffffff')).toEqual({ kind: 'unset' });
    expect(readFill('#f5f5f5')).toEqual({ kind: 'unset' });
    expect(readFill('#FAFAFA')).toEqual({ kind: 'unset' });
  });

  it('keeps light tints and greys as fills', () => {
    expect(readFill('#e0e0e0')).toEqual({ kind: 'hex', value: '#e0e0e0' });
    expect(readFill('#dae8fc')).toEqual({ kind: 'hex', value: '#dae8fc' });
    expect(readFill('#fff2cc')).toEqual({ kind: 'hex', value: '#fff2cc' });
    expect(readFill('none')).toEqual({ kind: 'none' });
  });

  it('reads hex ink and fills the same way', () => {
    expect(hexInk('#000')).toBeUndefined();
    expect(hexInk('#ff0000')).toBe('#ff0000');
    expect(hexFill('#fff')).toBeUndefined();
  });
});
