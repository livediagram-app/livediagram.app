// @vitest-environment jsdom

// The element menu's Size boxes (docs/specs/008-canvas/element-size.md): a typed size commits once, on Enter or
// when the box loses focus, and Escape throws the typing away.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SizeSection } from './SizeSection';

afterEach(() => cleanup());

function renderSection() {
  const onSetSize = vi.fn();
  render(
    <SizeSection
      width={200}
      height={72}
      aspectLocked={false}
      onSetSize={onSetSize}
      onToggleAspectLock={() => {}}
      onResetAspectRatio={() => {}}
      showReset={false}
    />,
  );
  const width = screen.getByLabelText(/^Width/) as HTMLInputElement;
  width.focus();
  fireEvent.change(width, { target: { value: '400' } });
  return { onSetSize, width };
}

describe('SizeSection', () => {
  it('commits a typed width once on Enter, not again on the blur Enter causes', () => {
    const { onSetSize, width } = renderSection();
    fireEvent.keyDown(width, { key: 'Enter' });
    expect(document.activeElement).not.toBe(width);
    expect(onSetSize).toHaveBeenCalledTimes(1);
    expect(onSetSize).toHaveBeenCalledWith({ width: 400 });
  });

  it('commits a typed width when the box loses focus', () => {
    const { onSetSize, width } = renderSection();
    width.blur();
    expect(onSetSize).toHaveBeenCalledExactlyOnceWith({ width: 400 });
  });

  it('throws the typing away on Escape instead of committing it on the way out', () => {
    const { onSetSize, width } = renderSection();
    fireEvent.keyDown(width, { key: 'Escape' });
    expect(onSetSize).not.toHaveBeenCalled();
    expect(width.value).toBe('200');
    // The next edit still commits.
    width.focus();
    fireEvent.change(width, { target: { value: '300' } });
    width.blur();
    expect(onSetSize).toHaveBeenCalledExactlyOnceWith({ width: 300 });
  });
});
