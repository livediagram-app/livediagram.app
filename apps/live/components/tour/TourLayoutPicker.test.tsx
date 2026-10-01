// @vitest-environment jsdom
// The welcome card's panel-layout picker (docs/specs/007-editor/editor-tour.md): picks write the
// preference the way the Settings row does, tracked with the option in the
// type, and a phone, which only has Toolbar, gets no picker.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserPreferences } from '@/lib/user-preferences';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const ctx = vi.hoisted(() => ({
  userPreferences: {} as UserPreferences,
  setUserPreferences: vi.fn(),
  writeUserPreferences: vi.fn(),
  selfParticipant: { id: 'me' },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

import { TourLayoutPicker } from './TourLayoutPicker';

afterEach(() => {
  cleanup();
  mobile.value = false;
  ctx.userPreferences = {};
  vi.clearAllMocks();
});

const option = (name: string) => screen.getByRole('radio', { name });

describe('TourLayoutPicker', () => {
  it('rings the layout in force', () => {
    ctx.userPreferences = { panelLayout: 'toolbar' };
    render(<TourLayoutPicker />);
    expect(option('Toolbar').getAttribute('aria-checked')).toBe('true');
    expect(option('Floating').getAttribute('aria-checked')).toBe('false');
  });

  it('writes and tracks a pick like the Settings row', () => {
    render(<TourLayoutPicker />);
    fireEvent.click(option('Toolbar'));
    const next = { panelLayout: 'toolbar' };
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PanelLayoutToolbar');
    expect(ctx.setUserPreferences).toHaveBeenCalledWith(next);
    expect(ctx.writeUserPreferences).toHaveBeenCalledWith(next, 'me');
  });

  it('does nothing when the current layout is clicked again', () => {
    render(<TourLayoutPicker />);
    fireEvent.click(option('Floating'));
    expect(ctx.setUserPreferences).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('offers no choice on a phone, where Toolbar is the only layout', () => {
    mobile.value = true;
    render(<TourLayoutPicker />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
