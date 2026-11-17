// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ElementKindToolButtons,
  hasKindVerbs,
  useElementKindTools,
  usePublishElementKindTools,
  type ElementKindTools,
} from './element-kind-tools';

// The element kind's own verbs (docs/specs/008-canvas/element-menu-quick-bar.md): the canvas publishes the selected
// element's, and the element menu's bar reads them for the element it opened on.

afterEach(cleanup);

const STEP: ElementKindTools['flowchartStep'] = {
  onAddStep: () => {},
  onAddBranch: () => {},
  stepType: 'process',
  onSetStepType: () => {},
  lanes: [{ id: 'l1', title: 'Sales' }],
  laneId: 'l1',
  onMoveToLane: () => {},
};

function Harness({
  publish,
  read,
  tools,
}: {
  publish: string | null;
  read: string;
  tools: ElementKindTools;
}) {
  usePublishElementKindTools(publish, tools);
  const got = useElementKindTools(read);
  return <span data-testid="got">{got ? 'tools' : 'none'}</span>;
}

describe('the kind tools store', () => {
  it('hands the menu the tools of the element it opened on, and none for another', () => {
    const tools = { onAddMindChild: vi.fn(), onAddMindSibling: vi.fn() };
    const { rerender } = render(<Harness publish="a" read="a" tools={tools} />);
    expect(screen.getByTestId('got').textContent).toBe('tools');
    rerender(<Harness publish="a" read="b" tools={tools} />);
    expect(screen.getByTestId('got').textContent).toBe('none');
  });

  it('publishes nothing for an element with no tools, or no selection', () => {
    const { rerender } = render(<Harness publish="a" read="a" tools={{}} />);
    expect(screen.getByTestId('got').textContent).toBe('none');
    rerender(<Harness publish={null} read="a" tools={{ flowchartStep: STEP }} />);
    expect(screen.getByTestId('got').textContent).toBe('none');
  });
});

describe('ElementKindToolButtons', () => {
  // Mind map (docs/specs/009-elements/mind-node.md): Add Child and Add Sibling.
  it('offers Add Child and Add Sibling on a mind node, each firing its own grower', () => {
    const child = vi.fn();
    const sibling = vi.fn();
    render(<ElementKindToolButtons tools={{ onAddMindChild: child, onAddMindSibling: sibling }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Child' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Sibling' }));
    expect(child).toHaveBeenCalledOnce();
    expect(sibling).toHaveBeenCalledOnce();
  });

  it('offers a flowchart step its Step Type, with no rule left trailing it', () => {
    const { container } = render(<ElementKindToolButtons tools={{ flowchartStep: STEP }} />);
    expect(screen.getByRole('button', { name: 'Step Type' })).toBeTruthy();
    expect(container.querySelector('.contents')?.className).toContain(
      '[&>[aria-hidden]:last-child]:hidden',
    );
  });

  it('counts only real verbs, not Save to Library alone', () => {
    expect(hasKindVerbs({ saveToLibrary: () => null })).toBe(false);
    expect(hasKindVerbs({ flowchartStep: STEP })).toBe(true);
    expect(hasKindVerbs({ onAddMindChild: () => {} })).toBe(false);
  });
});
