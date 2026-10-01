// @vitest-environment jsdom
// The UI Scale row (docs/specs/007-editor/ui-scale.md "In Settings"): a slider
// in Appearance that commits on release with UI / Changed / UiScale, and is
// greyed with a note on a phone, where the chrome always draws at 100%.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import type { UserPreferences } from '@/lib/user-preferences';
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
  const slider = screen.getByRole('slider', { name: 'UI Scale' }) as HTMLInputElement;
  return { onChange, slider };
}

describe('UI Scale row', () => {
  it('reads 100% when unset', () => {
    const { slider } = show();
    expect(slider.value).toBe('1');
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('commits on release and tracks the change', () => {
    const { slider, onChange } = show({ uiScale: 1 });
    fireEvent.change(slider, { target: { value: '1.25' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledWith({ uiScale: 1.25 });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'UiScale');
  });

  it('is greyed on a phone, with a note, keeping the stored value', () => {
    mobile.value = true;
    const { slider } = show({ uiScale: 1.25 });
    expect(slider.disabled).toBe(true);
    expect(slider.value).toBe('1.25');
    expect(screen.getAllByRole('note').map((n) => n.textContent)).toContain(
      'UI Scale is desktop only, so a phone always uses 100%. Your choice still applies on a larger screen.',
    );
  });
});
