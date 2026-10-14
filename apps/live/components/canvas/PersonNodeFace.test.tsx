// @vitest-environment jsdom

// A person node's face (docs/specs/009-elements/org-chart.md): initials, the name (its label) and the role line,
// edited in place once selected.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyShapeVariant, createShape, type ShapeElement } from '@livediagram/document';
import { PersonNodeFace } from './PersonNodeFace';

afterEach(cleanup);

const person = (over: Partial<ShapeElement> = {}) =>
  ({
    ...applyShapeVariant(createShape('mind-node', 0, 0) as ShapeElement, 'org-chart'),
    ...over,
  }) as ShapeElement;

function show(element: ShapeElement, editable = true) {
  const onSetRole = vi.fn();
  render(
    <PersonNodeFace
      element={element}
      labelNode={<span>{element.label}</span>}
      accent="#0284c7"
      ink="#0f172a"
      fontFamily={undefined}
      editable={editable}
      onSetRole={onSetRole}
    />,
  );
  return onSetRole;
}

describe('PersonNodeFace', () => {
  it('draws the initials, the name and the role', () => {
    show(person(), false);
    expect(screen.getByText('AK')).toBeTruthy();
    expect(screen.getByText('Ana Kim')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Role' }).textContent).toBe('Head of Engineering');
  });

  it('commits an edited role', () => {
    const onSetRole = show(person());
    const line = screen.getByRole('textbox', { name: 'Role' });
    fireEvent.focus(line);
    line.textContent = 'CTO';
    fireEvent.keyDown(line, { key: 'Enter' });
    fireEvent.blur(line);
    expect(onSetRole).toHaveBeenCalledWith('CTO');
  });

  it('shows no role line for a node without one unless it is being edited', () => {
    show(person({ pageSubtitle: undefined }), false);
    expect(screen.queryByRole('textbox', { name: 'Role' })).toBeNull();
  });
});
