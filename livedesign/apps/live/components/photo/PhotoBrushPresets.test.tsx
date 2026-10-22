// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Imported once, ahead of the tests: its store is first read in the test that renders it.
import { BrushPresetGrid } from './PhotoBrushPresets';

// docs/specs/031-photo/photo-tools.md "Shared gestures and options": Brush Presets and Save Preset.
const KEY = 'livedesign:photo-brush-presets';

// The store afresh, reading what this browser kept.
async function freshStore() {
  vi.resetModules();
  return import('@/lib/photo-editor/brush-presets');
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the brush presets', () => {
  it('offer the seven built in, then the person’s own, kept for this browser', async () => {
    const m = await freshStore();
    expect(m.brushPresets().map((p) => p.name)).toEqual([
      'Soft Round',
      'Hard Round',
      'Airbrush',
      'Chalk',
      'Ink',
      'Marker',
      'Spray',
    ]);
    const saved = m.savePreset('  My Tip  ', { size: 9, hardness: 0.5, flow: 0.7, spacing: 0.2 });
    expect(saved).toMatchObject({ name: 'My Tip', size: 9, own: true });
    const again = await freshStore();
    expect(again.brushPresets().at(-1)).toMatchObject({ name: 'My Tip', own: true });
    again.deletePreset(saved.id);
    expect(again.brushPresets()).toHaveLength(7);
  });

  it('name an unnamed preset, keep the last OWN_PRESETS_MAX, and ignore what they cannot read', async () => {
    const m = await freshStore();
    for (let i = 0; i < m.OWN_PRESETS_MAX + 2; i++)
      m.savePreset('', { size: i + 1, hardness: 1, flow: 1, spacing: 0.1 });
    const own = m.brushPresets().filter((p) => p.own);
    expect(own).toHaveLength(m.OWN_PRESETS_MAX);
    expect(own[0]!.size).toBe(3);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'x', name: 'Bad', size: 'big' }, 7]));
    expect((await freshStore()).brushPresets()).toHaveLength(7);
    localStorage.setItem(KEY, '{nope');
    expect((await freshStore()).brushPresets()).toHaveLength(7);
  });

  it('take a preset’s tip, and save the tip in hand under a name', () => {
    const onTake = vi.fn();
    render(
      <BrushPresetGrid tip={{ size: 12, hardness: 0.25, flow: 1, spacing: 0.1 }} onTake={onTake} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Airbrush/ }));
    expect(onTake).toHaveBeenCalledWith({ size: 120, hardness: 0, flow: 0.08, spacing: 0.05 });
    fireEvent.change(screen.getByRole('textbox', { name: 'Preset Name' }), {
      target: { value: 'Detail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Preset' }));
    expect(screen.getByRole('button', { name: 'Detail' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Detail' }));
    expect(screen.queryByRole('button', { name: 'Detail' })).toBeNull();
  });
});
