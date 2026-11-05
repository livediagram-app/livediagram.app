// @vitest-environment jsdom

// The Stage's section in the element menu (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way
// in"): Who Can Speak as two tiles, Show Cameras as a switch.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { StageMenuSection } from './StageMenuSection';

afterEach(cleanup);

const stage = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('stage', 0, 0), ...over }) as ShapeElement;

function show(target: ShapeElement) {
  const onSetStage = vi.fn();
  render(
    <StageMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetStage={onSetStage}
    />,
  );
  return onSetStage;
}

describe('StageMenuSection', () => {
  it('reads a new stage as Editors speaking, cameras off', () => {
    show(stage());
    const group = screen.getByRole('group', { name: 'Who Can Speak' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editors' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Editors and Participants' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(screen.getByRole('button', { name: /Show Cameras/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('lets Participants speak, and back to Editors only', () => {
    const onSetStage = show(stage());
    fireEvent.click(screen.getByRole('button', { name: 'Editors and Participants' }));
    expect(onSetStage).toHaveBeenLastCalledWith({ stageSpeakers: 'take-part' });
    fireEvent.click(screen.getByRole('button', { name: 'Editors' }));
    expect(onSetStage).toHaveBeenLastCalledWith({ stageSpeakers: 'edit' });
  });

  it('shows what is stored, and flips Show Cameras off again', () => {
    const onSetStage = show(stage({ stageSpeakers: 'take-part', stageCameras: true }));
    expect(
      screen.getByRole('button', { name: 'Editors and Participants' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const cameras = screen.getByRole('button', { name: /Show Cameras/ });
    expect(cameras.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(cameras);
    expect(onSetStage).toHaveBeenLastCalledWith({ stageCameras: false });
  });
});
