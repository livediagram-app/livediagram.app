// @vitest-environment jsdom
// Desktop-only choice options on a phone (docs/specs/007-editor/toolbar-layout.md): Floating is shown but
// can't be picked, and a note says why. Toolbar works on a phone too. The
// drawing under a choice row picks an option when clicked, the same rules.
// A pick is tracked with the option in the type (docs/specs/017-telemetry/telemetry.md).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(() => {
  cleanup();
  mobile.value = false;
  track.mockClear();
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

// The Panel Layout drawing's states, in option order (Floating, Minimal,
// Toolbar).
const layoutDrawing = (index: number) =>
  screen.getByRole('img', { name: /three panel layouts/ }).querySelectorAll(':scope > g')[
    index
  ] as SVGGElement;

describe('SettingsCategoryPane on a phone', () => {
  it('disables the desktop-only layout and says why', () => {
    mobile.value = true;
    const onChange = show();
    expect(layoutOption('Floating').disabled).toBe(true);
    expect(layoutOption('Toolbar').disabled).toBe(false);
    expect(layoutOption('Minimal').disabled).toBe(false);
    expect(screen.getByRole('note').textContent).toBe(
      'Floating is desktop only. On a phone it uses the Toolbar layout instead.',
    );
    fireEvent.click(layoutOption('Floating'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("won't pick a disabled option from its drawing either", () => {
    mobile.value = true;
    const onChange = show();
    fireEvent.click(layoutDrawing(0));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(layoutDrawing(2));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ panelLayout: 'toolbar' }));
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

  it('picks an option by clicking its drawing, and ignores the one in force', () => {
    const onChange = show();
    fireEvent.click(layoutDrawing(1));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(layoutDrawing(0));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ panelLayout: 'floating' }));
  });
});

describe('SettingsCategoryPane telemetry', () => {
  it('tracks which layout was picked, not just that it changed', () => {
    show();
    fireEvent.click(layoutOption('Toolbar'));
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PanelLayoutToolbar');
  });

  it('tracks a pick made from the drawing the same way', () => {
    show();
    fireEvent.click(layoutDrawing(0));
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PanelLayoutFloating');
  });

  it("doesn't track a pick that can't happen", () => {
    mobile.value = true;
    show();
    fireEvent.click(layoutDrawing(0));
    expect(track).not.toHaveBeenCalled();
  });
});
