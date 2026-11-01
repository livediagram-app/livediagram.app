// @vitest-environment jsdom

// An infographic or slide page's Layout beside its cog (docs/specs/007-editor/pages-mode.md
// "Layouts"): the popover keeps to its layouts, with no Change Theme.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { PageLayoutsButton, pageLayoutsRoom } from './PageLayoutsButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const [slide] = layOutPages([newSlidePage('s', 'slide')]);

function show() {
  const onApply = vi.fn();
  const onPreview = vi.fn();
  render(<PageLayoutsButton page={slide!} labelled onApply={onApply} onPreview={onPreview} />);
  return { onApply, onPreview };
}

describe('PageLayoutsButton', () => {
  it('takes more room named than as an icon', () => {
    expect(pageLayoutsRoom(true)).toBeGreaterThan(pageLayoutsRoom(false));
  });

  it('opens the layouts, tracked, with a Close and no Change Theme', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageLayoutsButton');
    expect(document.querySelector('[data-page-layouts-popover]')).not.toBeNull();
    expect(screen.queryByText('Change Theme')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('[data-page-layouts-popover]')).toBeNull();
  });

  it('places a pressed layout, clears the preview and closes', () => {
    const { onApply, onPreview } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    fireEvent.click(document.querySelector('[data-layout-tile="slide-title"]')!);
    expect(onApply).toHaveBeenCalledWith('slide-title');
    expect(onPreview).toHaveBeenCalledWith(null);
    expect(document.querySelector('[data-page-layouts-popover]')).toBeNull();
  });
});
