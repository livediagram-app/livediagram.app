// @vitest-environment jsdom
// docs/specs/007-editor/toolbar-layout.md "The tab's name": a board's name in the menu box renames on a click.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from './plan-palette';
import { BoardTitle } from './BoardTitle';

afterEach(cleanup);

const palette = planPalette('light', {});
const show = (inBox: boolean, onStart?: () => void) =>
  render(
    <BoardTitle
      title="Roadmap"
      editing={false}
      selected
      palette={palette}
      inBox={inBox}
      onRename={vi.fn()}
      onDone={vi.fn()}
      onStart={onStart}
    />,
  );

describe('a board’s name in the menu box', () => {
  it('starts a rename on a single click', () => {
    const onStart = vi.fn();
    show(true, onStart);
    fireEvent.click(screen.getByText('Roadmap'));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('leaves a click on the canvas header to moving the board', () => {
    const onStart = vi.fn();
    show(false, onStart);
    fireEvent.click(screen.getByText('Roadmap'));
    expect(onStart).not.toHaveBeenCalled();
  });
});
