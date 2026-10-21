// @vitest-environment jsdom

// An infographic or slide page's Background beside its cog (docs/specs/007-editor/pages-mode.md
// "Beside the cog").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@liveplanner/document';
import { track } from '@/lib/telemetry';
import { PageBackgroundButton, pageBackgroundRoom } from './PageBackgroundButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const page: Page = { id: 'p', orientation: 'portrait' };

function show(labelled = true) {
  const onBackground = vi.fn();
  const onPreview = vi.fn();
  render(
    <PageBackgroundButton
      page={page}
      labelled={labelled}
      themePresets={[]}
      onBackground={onBackground}
      onPreview={onPreview}
    />,
  );
  return { onBackground, onPreview };
}

describe('PageBackgroundButton', () => {
  it('names itself on a desktop and shows its icon alone on a phone', () => {
    show(true);
    expect(screen.getByText('Background')).toBeTruthy();
    cleanup();
    show(false);
    expect(screen.queryByText('Background')).toBeNull();
    expect(screen.getByRole('button', { name: 'Background' })).toBeTruthy();
  });

  it('opens the Background and Pattern sections, tracked, and is a plain opener', () => {
    show();
    const button = screen.getByRole('button', { name: 'Background' });
    expect(button.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(button);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageBackgroundButton');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: 'Background kind' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Pattern' })).toBeTruthy();
  });

  it('previews on hover, commits a press and stays open, and drops the preview on close', () => {
    const { onBackground, onPreview } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    const dots = screen.getByRole('radio', { name: 'Dots' });
    fireEvent.pointerEnter(dots);
    expect(onPreview).toHaveBeenLastCalledWith({ pattern: 'dots' });
    fireEvent.click(dots);
    expect(onBackground).toHaveBeenCalledWith({ pattern: 'dots' });
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('radiogroup', { name: 'Pattern' })).toBeTruthy();
    onPreview.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    expect(screen.queryByRole('radiogroup', { name: 'Pattern' })).toBeNull();
    expect(onPreview).toHaveBeenCalledWith(null);
  });

  it('takes its room in the title bar', () => {
    expect(pageBackgroundRoom(true)).toBeGreaterThan(pageBackgroundRoom(false));
    expect(pageBackgroundRoom(false)).toBe(28);
  });
});
