import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Level } from '@liveworkspace/index-client';
import { RolePicker } from './RolePicker';

function Picker() {
  const [level, setLevel] = useState<Level>('view');
  return <RolePicker level={level} onChange={setLevel} />;
}

const card = () => screen.getByRole('button', { name: /^Pass level:/ });

// Folding the levels makes them inert, so focus on one must go back to the card rather than to the page.
describe('RolePicker', () => {
  it('hands focus back to the card when Escape folds the levels', () => {
    render(<Picker />);
    fireEvent.click(card());
    const viewer = screen.getByRole('radio', { name: /Viewer/ });
    viewer.focus();
    fireEvent.keyDown(viewer, { key: 'Escape' });
    expect(card().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(card());
  });

  it('hands focus back to the card when a level is chosen', () => {
    render(<Picker />);
    fireEvent.click(card());
    const editor = screen.getByRole('radio', { name: /Editor/ });
    editor.focus();
    fireEvent.click(editor);
    expect(card().getAttribute('aria-label')).toBe('Pass level: Editor. Change level');
    expect(document.activeElement).toBe(card());
  });
});
