// @vitest-environment jsdom
// The UI Scale rows (docs/specs/007-editor/ui-scale.md "In Settings"): a master
// slider in Appearance that sets every part, and one slider per part nested
// beneath it. Each previews live while dragged, commits on release with UI /
// Changed / <token>, and is greyed with a note on a phone.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import type { UserPreferences } from '@/lib/user-preferences';
import { getUiScalePreview } from '@/lib/ui-scale-preview';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(() => {
  cleanup();
  mobile.value = false;
  track.mockClear();
});

const APPEARANCE = SETTINGS_CATEGORIES.find((c) => c.id === 'appearance')!;

function show(settings: UserPreferences = {}) {
  const onChange = vi.fn();
  render(<SettingsCategoryPane category={APPEARANCE} settings={settings} onChange={onChange} />);
  const slider = (name: string) => screen.getByRole('slider', { name }) as HTMLInputElement;
  return { onChange, slider };
}

describe('UI Scale rows', () => {
  it('start at 100% when unset, in the middle of the slider but for the toolbar', () => {
    const { slider } = show();
    for (const name of ['UI Scale', 'Panel Scale', 'Corner Buttons Scale']) {
      const s = slider(name);
      expect(s.value).toBe('1');
      expect((Number(s.min) + Number(s.max)) / 2).toBe(1);
    }
    expect(slider('Toolbar Scale').value).toBe('1');
  });

  it('run the toolbar up to 140%', () => {
    const { slider } = show();
    expect(slider('Toolbar Scale').max).toBe('1.4');
    expect(slider('UI Scale').max).toBe('1.2');
  });

  it('show a part following the master until it has its own value', () => {
    const { slider } = show({ uiScale: 0.9, uiScaleToolbar: 1.15 });
    expect(slider('Panel Scale').value).toBe('0.9');
    expect(slider('Toolbar Scale').value).toBe('1.15');
  });

  it('the master commits on release, clearing every part', () => {
    const { slider, onChange } = show({ uiScale: 1, uiScaleToolbar: 1.15 });
    fireEvent.change(slider('UI Scale'), { target: { value: '0.9' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider('UI Scale'));
    expect(onChange).toHaveBeenCalledWith({ uiScale: 0.9 });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'UiScale');
  });

  it('a part commits only its own value', () => {
    const { slider, onChange } = show({ uiScale: 0.9 });
    fireEvent.change(slider('Toolbar Scale'), { target: { value: '1.2' } });
    fireEvent.pointerUp(slider('Toolbar Scale'));
    expect(onChange).toHaveBeenCalledWith({ uiScale: 0.9, uiScaleToolbar: 1.2 });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'UiScaleToolbar');
  });

  it('previews live while dragged, and ends the preview on release', () => {
    const { slider } = show({ uiScale: 1 });
    fireEvent.change(slider('Corner Buttons Scale'), { target: { value: '0.85' } });
    expect(getUiScalePreview()).toEqual({ uiScaleCornerButtons: 0.85 });
    fireEvent.pointerUp(slider('Corner Buttons Scale'));
    expect(getUiScalePreview()).toBeNull();
  });

  it('drops an uncommitted preview when the pane closes', () => {
    const { slider } = show({ uiScale: 1 });
    fireEvent.change(slider('UI Scale'), { target: { value: '0.8' } });
    expect(getUiScalePreview()).toMatchObject({ uiScale: 0.8 });
    cleanup();
    expect(getUiScalePreview()).toBeNull();
  });

  it('are greyed on a phone, with a note, keeping the stored value', () => {
    mobile.value = true;
    const { slider } = show({ uiScale: 1.15 });
    expect(slider('UI Scale').disabled).toBe(true);
    expect(slider('Panel Scale').disabled).toBe(true);
    expect(slider('UI Scale').value).toBe('1.15');
    expect(screen.getAllByRole('note').map((n) => n.textContent)).toContain(
      'UI Scale is desktop only, so a phone always uses 100%. Your choice still applies on a larger screen.',
    );
  });
});
