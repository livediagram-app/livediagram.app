import { describe, expect, it } from 'vitest';
import { svgPicker, type PickerSvgInput } from './svg-render-picker';

// The Picker at rest in an export (docs/specs/012-collaboration/picker.md "The look"): the payline in the
// accent, the result, the count and the Spin pill, as the canvas face stands.
const el = (over: Partial<PickerSvgInput> = {}): PickerSvgInput => ({
  id: 'p1',
  x: 0,
  y: 0,
  width: 240,
  height: 176,
  ...over,
});

describe('svgPicker', () => {
  it('draws the payline in the accent with the result and Spin Again', () => {
    const svg = svgPicker(el({ pickerResult: 'Sam' }), 'Who demos?', '#0f172a', '#db2777');
    expect(svg).toContain('fill="#db2777" fill-opacity="0.14"');
    expect(svg).toContain('>Sam</text>');
    expect(svg).toContain('>WHO DEMOS?</text>');
    expect(svg).toContain('>Spin Again</text>');
    // A people picker's room is not in the stored element: no count.
    expect(svg).not.toContain(' here<');
  });

  it('shows a question mark and Spin before the first roll, with the options counted', () => {
    const svg = svgPicker(
      el({ pickerSource: 'options', pickerOptions: ['A', ' ', 'B'] }),
      '',
      '#0f172a',
      '#0ea5e9',
    );
    expect(svg).toContain('>?</text>');
    expect(svg).toContain('>Spin</text>');
    expect(svg).toContain('>2 options</text>');
  });

  it('says when a list has nothing to pick from', () => {
    const svg = svgPicker(el({ pickerSource: 'options' }), '', '#0f172a', '#0ea5e9');
    expect(svg).toContain('>Nothing to pick from</text>');
  });

  it('counts what is left in a round, and offers Reset once all are drawn', () => {
    const round = {
      pickerSource: 'options' as const,
      pickerOptions: ['A', 'B'],
      pickerRemoveDrawn: true,
    };
    expect(
      svgPicker(
        el({ ...round, pickerDrawn: ['A', 'Gone'], pickerResult: 'A' }),
        '',
        '#0f172a',
        '#0ea5e9',
      ),
    ).toContain('>1 of 2 left</text>');
    const done = svgPicker(
      el({ ...round, pickerDrawn: ['A', 'B'], pickerResult: 'B' }),
      '',
      '#0f172a',
      '#0ea5e9',
    );
    expect(svgPicker(el(round), '', '#0f172a', '#0ea5e9')).toContain('>2 of 2 left</text>');
    expect(done).toContain('>All drawn</text>');
    expect(done).toContain('>Every option is drawn</text>');
    expect(done).toContain('>Reset</text>');
  });

  it('ignores drawn names while the setting is off, and fits a short card', () => {
    const svg = svgPicker(
      el({ pickerSource: 'options', pickerOptions: ['A', 'B'], pickerDrawn: ['A'], height: 70 }),
      'Hidden kicker',
      '#0f172a',
      '#0ea5e9',
    );
    expect(svg).not.toContain('HIDDEN KICKER');
    expect(svg).not.toContain('left<');
  });

  it('cuts a long name to the payline', () => {
    const svg = svgPicker(
      el({ pickerResult: 'A very long name that will never fit on one small payline' }),
      '',
      '#0f172a',
      '#0ea5e9',
    );
    expect(svg).toContain('…</text>');
  });
});
