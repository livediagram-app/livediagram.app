// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinksToPicker, linkTypeNames, linksToLabel, toggledLinkTypes } from './LinksToPicker';

// docs/specs/026-plan/item-types.md "Editing a type": Links To, a multi-select of card types.
const draw = (value: readonly string[]) => {
  const onChange = vi.fn();
  render(<LinksToPicker value={value} onChange={onChange} />);
  return onChange;
};
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Links To' }));
const row = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });

describe('Links To', () => {
  it('names the ticked types on its button', () => {
    expect(linksToLabel([])).toBe('Links To a Card Type…');
    expect(linksToLabel(['Project'])).toBe('Links To Project');
    expect(linksToLabel(['Project', 'Epic'])).toBe('Links To Project or Epic');
    expect(linksToLabel(['Project', 'Epic', 'Bug', 'Task'])).toBe(
      'Links To Project, Epic and 2 more',
    );
    expect(linkTypeNames(['Project', 'Epic', 'Bug'])).toBe('Project, Epic or Bug');
    expect(linkTypeNames([])).toBe('');
  });

  it('ticks in order and never empties the list', () => {
    expect(toggledLinkTypes(['project'], 'task')).toEqual(['project', 'task']);
    expect(toggledLinkTypes(['project', 'task'], 'project')).toEqual(['task']);
    expect(toggledLinkTypes(['project'], 'project')).toEqual(['project']);
  });

  it('opens a checkbox row per card type, the ticked ones checked, the last one held', () => {
    draw(['project']);
    expect(screen.getByRole('button', { name: 'Links To' }).textContent).toBe('Links To Project');
    open();
    expect(row('Project').getAttribute('aria-checked')).toBe('true');
    expect(row('Task').getAttribute('aria-checked')).toBe('false');
    expect((row('Project') as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a ticked type and stays open for more', () => {
    const onChange = draw(['project']);
    open();
    fireEvent.click(row('Task'));
    expect(onChange).toHaveBeenCalledWith(['project', 'task']);
    expect(row('Idea')).toBeTruthy();
  });

  it('unticks one of several, and names a gone type by its id', () => {
    const onChange = draw(['project', 'gone']);
    expect(screen.getByRole('button', { name: 'Links To' }).textContent).toBe(
      'Links To Project or gone',
    );
    open();
    fireEvent.click(row('Project'));
    expect(onChange).toHaveBeenCalledWith(['gone']);
  });

  it('opens from the keyboard', () => {
    draw([]);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Links To' }), { key: 'ArrowDown' });
    expect(row('Task')).toBeTruthy();
  });
});
