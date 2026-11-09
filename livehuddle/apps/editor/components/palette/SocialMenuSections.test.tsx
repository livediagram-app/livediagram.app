// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livehuddle/document';
import { WorldClockMenuSection } from './SocialMenuSections';

// docs/specs/009-elements/social-pieces.md "World Clock": an Editor's menu adds zones by the browser's own name for
// them and keeps every zone labelled.

const clock = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'clock',
  type: 'shape',
  shape: 'world-clock',
  x: 0,
  y: 0,
  width: 168,
  height: 72,
  ...over,
});

function open(target: ShapeElement) {
  const onSetZones = vi.fn();
  render(
    <WorldClockMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetZones={onSetZones}
    />,
  );
  return onSetZones;
}

describe('the World Clock menu section', () => {
  it('adds a zone typed in lower case by its proper name and city', () => {
    const onSetZones = open(clock());
    fireEvent.change(screen.getByPlaceholderText('Europe/London'), {
      target: { value: 'europe/london' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSetZones).toHaveBeenCalledWith([{ zone: 'Europe/London', label: 'London' }]);
  });

  it('refuses a zone the browser does not know', () => {
    const onSetZones = open(clock());
    fireEvent.change(screen.getByPlaceholderText('Europe/London'), {
      target: { value: 'Mars/Base' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSetZones).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('time zone');
  });

  it('puts a cleared label back when the field is left, never leaving it blank', () => {
    // Cleared and left, the field stayed blank while the clock kept its old label.
    const onSetZones = open(clock({ clockZones: [{ zone: 'Asia/Tokyo', label: 'Tokyo' }] }));
    const field = screen.getByLabelText('Label for Asia/Tokyo') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    expect(field.value).toBe('Tokyo');
    expect(onSetZones).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: ' Tokyo office ' } });
    fireEvent.blur(field);
    expect(onSetZones).toHaveBeenCalledWith([{ zone: 'Asia/Tokyo', label: 'Tokyo office' }]);
  });
});
