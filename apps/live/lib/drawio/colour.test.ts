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
