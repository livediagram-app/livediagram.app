// @vitest-environment jsdom
// Desktop-only choice options on a phone (spec/148): Floating and Toolbar are
// shown but can't be picked, and a note says why.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(() => {
  cleanup();
  mobile.value = false;
});

const APPEARANCE = SETTINGS_CATEGORIES.find((c) => c.id === 'appearance')!;

function show(onChange = vi.fn()) {
  render(
    <SettingsCategoryPane
      category={APPEARANCE}
      settings={{ panelLayout: 'minimal' }}
      onChange={onChange}
    />,
  );
  return onChange;
}

const layoutOption = (label: string) =>
  screen
    .getByRole('radiogroup', { name: 'Panel Layout' })
    .querySelector(
      `[role="radio"]:nth-child(${['Floating', 'Minimal', 'Toolbar'].indexOf(label) + 1})`,
    ) as HTMLButtonElement;

describe('SettingsCategoryPane on a phone', () => {
  it('disables the desktop-only layouts and says why', () => {
    mobile.value = true;
    const onChange = show();
    expect(layoutOption('Floating').disabled).toBe(true);
    expect(layoutOption('Toolbar').disabled).toBe(true);
    expect(layoutOption('Minimal').disabled).toBe(false);
    expect(screen.getByRole('note').textContent).toBe(
      'Floating and Toolbar are desktop only. On a phone the panels always use the button bar.',
    );
    fireEvent.click(layoutOption('Floating'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers every layout on desktop, with no note', () => {
    const onChange = show();
    for (const label of ['Floating', 'Minimal', 'Toolbar']) {
      expect(layoutOption(label).disabled, label).toBe(false);
    }
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(layoutOption('Toolbar'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ panelLayout: 'toolbar' }));
  });
});
