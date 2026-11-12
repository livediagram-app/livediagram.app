// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import type { RemoteSelector } from '@/lib/presence-rows';

// A collaborator's selection shows as the element's outline in their colour (docs/specs/007-editor/editor-app.md "Concurrent-selection lock");
// it never recolours a face. A card being dragged by someone else once turned its header band into the selector's
// colour; a stored card now draws the placeholder, which keeps its own look.

const PURPLE = 'rgb(124, 58, 237)';
const selector: RemoteSelector = { id: 'peer', name: 'Peer', color: PURPLE, holds: true };

function draw(element: BoxedElement, remoteSelectors: RemoteSelector[]) {
  return render(
    <BoxedElementView
      element={element}
      isSelected={false}
      isEditing={false}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onContextSelect={vi.fn()}
      tabSummaries={[]}
      readOnly={false}
      remoteSelectors={remoteSelectors}
    />,
  );
}

const painted = (container: HTMLElement, colour: string) =>
  [...container.querySelectorAll<HTMLElement>('*')].some((n) => n.style.backgroundColor === colour);

describe('a remote selection and a face accent', () => {
  it("never paints a stored card's placeholder in a collaborator's colour", () => {
    const card = {
      ...createShape('room', 0, 0),
      shape: 'card',
      width: 280,
      height: 150,
      strokeColor: '#0284c7',
    } as unknown as BoxedElement;
    const { container } = draw(card, [selector]);
    expect(container.querySelector('[data-retired-element]')).not.toBeNull();
    expect(painted(container, PURPLE)).toBe(false);
  });
});
