// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The quick panel": a tool's main numbers at the canvas's left while it is in
// hand, stepping aside for the options flyout.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { photoView } from './photo-view-test-utils';
import { PhotoQuickPanel, quickFields } from './PhotoQuickPanel';

beforeEach(() =>
  act(() => {
    photoTools.take(null);
    photoTools.resetOptions('brush');
    toolFlyout.close();
  }),
);
afterEach(cleanup);

describe('the quick panel', () => {
  it("holds a tool's main numbers, tip first, and none for a tool without", () => {
    expect(quickFields('brush').map((f) => f.label)).toEqual([
      'Size',
      'Hardness',
      'Opacity',
      'Flow',
    ]);
    expect(quickFields('magic-wand').map((f) => f.label)).toEqual(['Tolerance']);
    expect(quickFields('move')).toEqual([]);
  });

  it('shows while the tool is in hand, sets its options, and steps aside for the flyout', () => {
    const { view } = photoView();
    render(<PhotoQuickPanel photo={view} top={80} left={12} />);
    expect(screen.queryByRole('complementary')).toBeNull();
    act(() => photoTools.take('brush'));
    expect(screen.getByRole('complementary', { name: 'Brush Quick Settings' })).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Opacity' }), { target: { value: '0.5' } });
    expect(photoTools.get().options.brush.opacity).toBe(0.5);
    fireEvent.click(screen.getByRole('button', { name: 'All Options' }));
    expect(toolFlyout.isOpen()).toBe(true);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('sits where it is told from the left, so a docked Contents sidebar keeps it clear', () => {
    const { view } = photoView();
    render(<PhotoQuickPanel photo={view} top={80} left={252} />);
    act(() => photoTools.take('brush'));
    const panel = screen.getByRole('complementary', { name: 'Brush Quick Settings' });
    expect(panel.style.left).toBe('252px');
    expect(panel.style.top).toBe('80px');
  });
});
