// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditingModeButton } from './EditingModeButton';
import { editingModes } from '../../lib/editing-mode';
import type { EditingModeRole } from '../../lib/editing-mode';

// liveworkspace/docs/specs/004-index/footer-tools-menu.md "The Editing Mode button" (Work Tracker 1291): only the mode
// in force, as an icon and a word in the neighbours' neutral styling; a press moves to the next mode, wrapping round;
// one mode, no button.

afterEach(cleanup);

function renderButton(
  props: Partial<{
    mode: EditingModeRole;
    real: EditingModeRole;
    owner: string;
    labelled: boolean;
    onPick: (m: EditingModeRole) => void;
  }> = {},
) {
  const real = props.real ?? 'edit';
  return render(
    <EditingModeButton
      mode={props.mode ?? real}
      modes={editingModes(real)}
      noun="canvas"
      owner={props.owner ?? ''}
      labelled={props.labelled ?? true}
      onPick={props.onPick ?? (() => {})}
    />,
  );
}

const button = () => screen.getByRole('button');
// The hover card's description, read through the button's aria-describedby.
const described = () =>
  document.getElementById(button().getAttribute('aria-describedby') ?? '')?.textContent;

describe('EditingModeButton', () => {
  it('shows only the mode in force, named with the mode and what a press does', () => {
    renderButton();
    expect(button()).toHaveProperty('textContent', 'Editor');
    expect(button().getAttribute('aria-label')).toBe(
      'Editing Mode: Editor. Switch to Participant.',
    );
    expect(button().getAttribute('data-editing-mode')).toBe('edit');
    // No role colour: the neighbours' neutral chrome button.
    expect(button().className).toContain('text-slate-600');
    expect(button().className).not.toMatch(/emerald|teal|amber/);
    expect(described()).toBe(
      'Click to see the canvas as a Participant. Only you see the change; everyone else keeps their own role.',
    );
  });

  it('steps an Editor through Participant and Viewer and back', () => {
    const onPick = vi.fn();
    const { rerender } = renderButton({ onPick });
    fireEvent.click(button());
    expect(onPick).toHaveBeenLastCalledWith('participate');
    const modes = editingModes('edit');
    rerender(
      <EditingModeButton mode="participate" modes={modes} noun="canvas" owner="" onPick={onPick} />,
    );
    expect(button().getAttribute('aria-label')).toBe(
      'Editing Mode: Participant. Switch to Viewer.',
    );
    expect(described()).toMatch(/^Click to see the canvas as a Viewer\. Only you/);
    fireEvent.click(button());
    expect(onPick).toHaveBeenLastCalledWith('view');
    rerender(
      <EditingModeButton mode="view" modes={modes} noun="canvas" owner="" onPick={onPick} />,
    );
    expect(button().getAttribute('aria-label')).toBe('Editing Mode: Viewer. Switch to Editor.');
    expect(described()).toMatch(/^Click to go back to editing\. Only you/);
    fireEvent.click(button());
    expect(onPick).toHaveBeenLastCalledWith('edit');
  });

  it('steps a Participant to Viewer and back to participating', () => {
    const onPick = vi.fn();
    renderButton({ real: 'participate', mode: 'view', onPick });
    expect(button().getAttribute('aria-label')).toBe(
      'Editing Mode: Viewer. Switch to Participant.',
    );
    expect(described()).toMatch(/^Click to go back to participating\. Only you/);
    fireEvent.click(button());
    expect(onPick).toHaveBeenCalledWith('participate');
  });

  it('draws nothing with one mode (a Viewer)', () => {
    const { container } = renderButton({ real: 'view' });
    expect(container.innerHTML).toBe('');
  });

  it('keeps the word out of the bar when labels are off, the name still carrying it', () => {
    renderButton({ labelled: false });
    expect(button().textContent).toBe('');
    expect(button().getAttribute('aria-label')).toBe(
      'Editing Mode: Editor. Switch to Participant.',
    );
  });

  it('says who owns the item, where known', () => {
    renderButton({ owner: 'Owned by Sam' });
    expect(described()).toBe(
      'Click to see the canvas as a Participant. Owned by Sam. Only you see the change; everyone else keeps their own role.',
    );
  });
});
