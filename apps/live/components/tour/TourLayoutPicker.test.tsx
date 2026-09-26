// @vitest-environment jsdom
// The welcome card's panel-layout picker (docs/specs/007-editor/editor-tour.md): picks write the
// preference the way the Settings row does (panelLayout + the legacy
// minimalPanels flag), tracked with the option in the type, and Floating
// isn't offered on a phone.
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
vi.mock('@/app/diagram/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

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
    fireEvent.click(option('Minimal'));
    const next = { panelLayout: 'minimal', minimalPanels: true };
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PanelLayoutMinimal');
    expect(ctx.setUserPreferences).toHaveBeenCalledWith(next);
    expect(ctx.writeUserPreferences).toHaveBeenCalledWith(next, 'me');
  });

  it('does nothing when the current layout is clicked again', () => {
    render(<TourLayoutPicker />);
    fireEvent.click(option('Floating'));
    expect(ctx.setUserPreferences).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('leaves Floating out on a phone', () => {
    mobile.value = true;
    ctx.userPreferences = { panelLayout: 'toolbar' };
    render(<TourLayoutPicker />);
    expect(screen.queryByRole('radio', { name: 'Floating' })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(option('Toolbar').getAttribute('aria-checked')).toBe('true');
  });

  it('rings Toolbar on a phone when Floating is stored, as that is what the phone shows', () => {
    mobile.value = true;
    render(<TourLayoutPicker />);
    expect(option('Toolbar').getAttribute('aria-checked')).toBe('true');
  });
});
