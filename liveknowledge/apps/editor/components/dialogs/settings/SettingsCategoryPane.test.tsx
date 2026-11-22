// @vitest-environment jsdom
// Desktop-only choice options on a phone (docs/specs/007-editor/toolbar-layout.md): Floating is shown but
// can't be picked, and a note says why. Toolbar works on a phone too. The
// drawing under a choice row picks an option when clicked, the same rules.
// A pick is tracked with the option in the type (docs/specs/017-telemetry/telemetry.md).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './test-pane';

afterEach(() => {
  cleanup();
  mobile.value = false;
  track.mockClear();
});

const PANELS = SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!;

function show(onChange = vi.fn(), category = PANELS) {
  render(<SettingsCategoryPane category={category} settings={{}} onChange={onChange} />);
  return onChange;
}

// A whole desktop-only row (Appearance's Button Labels): a phone always draws those buttons as icons, so the row is
// greyed and inert there, with a note, rather than flipping to no visible effect.
describe('SettingsCategoryPane desktop-only rows', () => {
  const APPEARANCE = SETTINGS_CATEGORIES.find((c) => c.id === 'appearance')!;
  const labels = () => screen.getByRole<HTMLButtonElement>('switch', { name: /Button Labels/ });

  it('greys out Button Labels on a phone, says why, and ignores a tap', () => {
    mobile.value = true;
    const onChange = show(vi.fn(), APPEARANCE);
    expect(labels().disabled).toBe(true);
    expect(
      screen
        .getAllByRole('note')
        .some((n) => /Phones always show these buttons as icons/.test(n.textContent ?? '')),
    ).toBe(true);
    fireEvent.click(labels());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves it working on desktop, with no note', () => {
    const onChange = show(vi.fn(), APPEARANCE);
    expect(labels().disabled).toBe(false);
    const was = labels().getAttribute('aria-checked') === 'true';
    fireEvent.click(labels());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dockButtonNames: !was }));
  });
});

describe('SettingsCategoryPane tours', () => {
  const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;

  // docs/specs/030-knowledgebase/page-surface.md "What a page no longer has": a knowledgebase has one kind of page
  // and no Pages tour, so Getting Started holds Show Me alone.
  it('offers no Pages tour switch, only Show Me', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ pagesTourSeen: true, pagesTourKinds: ['slide', 'article'] }}
        onChange={vi.fn()}
      />,
    );
    for (const gone of ['Pages Tours', 'Slides Tour', 'Infographic Tour', 'Article Tour'])
      expect(screen.queryByRole('switch', { name: gone })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Offer Again' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Show Me/ })).toBeTruthy();
  });
});
