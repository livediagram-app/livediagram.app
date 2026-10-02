import { describe, expect, it } from 'vitest';
import { readColour } from './colour';

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
    const started = performance.now();
    expect(readColour(`light-dark(a${' '.repeat(100_000)}`)).toEqual(readColour(undefined));
    expect(performance.now() - started).toBeLessThan(20);
  });

  it('still reads light-dark() with spaces around its first colour', () => {
    expect(readColour('light-dark(  #112233  , #ffffff)')).toEqual({
      kind: 'hex',
      value: '#112233',
    });
  });
});
