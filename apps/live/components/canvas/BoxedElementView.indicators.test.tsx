// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

// docs/specs/008-canvas/element-indicators.md, through the real element view: the indicators draw
// inside the element, the content moves out of their way, selection fades them, Off hides them.

const cloud = {
  ...createShape('cloud', 0, 0),
  width: 270,
  height: 180,
  label: 'Cloud',
  textSize: 'md',
  iconId: 'cloud',
  iconPosition: 'above',
  note: 'A note',
  link: { kind: 'url', url: 'https://example.com' },
  commentThread: {
    resolved: false,
    comments: [
      { id: '1', text: 'c', authorId: 'me', authorName: 'Me', authorColor: '#000', createdAt: 0 },
    ],
  },
} as BoxedElement;

function draw(
  element: BoxedElement,
  { selected = false, style = 'top' }: { selected?: boolean; style?: ElementIndicatorStyle } = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ElementIndicatorStyleProvider style={style}>{children}</ElementIndicatorStyleProvider>
  );
  return render(
    <BoxedElementView
      element={element}
      isSelected={selected}
      isEditing={false}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCommitTable={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onOpenComments={vi.fn()}
      onOpenAction={vi.fn()}
      onOpenNote={vi.fn()}
      isoDepth={0}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={false}
      tabSummaries={[]}
      readOnly={false}
      remoteSelectors={[]}
    />,
    { wrapper },
  );
}

describe('BoxedElementView indicators', () => {
  it('draws the indicators along the top and moves the icon and label down', () => {
    const { container, getByText } = draw(cloud);
    const cluster = container.querySelector<HTMLElement>('[data-indicators="top"]')!;
    expect(cluster).not.toBeNull();
    expect(cluster.querySelectorAll('button')).toHaveLength(3);
    // The content area starts below the cluster.
    const moved = getByText('Cloud').closest<HTMLElement>('.inset-x-0')!;
    expect(parseFloat(moved.style.top)).toBeGreaterThan(0);
  });

  it('fades the indicators out while the element is selected', () => {
    const { container } = draw(cloud, { selected: true });
    const cluster = container.querySelector<HTMLElement>('[data-indicators]')!;
    expect(cluster.hasAttribute('inert')).toBe(true);
    expect(cluster.className).toContain('opacity-0');
  });

  it('draws none and moves nothing when indicators are off', () => {
    const { container, getByText } = draw(cloud, { style: 'off' });
    expect(container.querySelector('[data-indicators]')).toBeNull();
    expect(getByText('Cloud').closest('.inset-x-0')).toBeNull();
  });

  it('draws none on an element that carries nothing', () => {
    const plain = { ...createShape('square', 0, 0), label: 'Plain' } as BoxedElement;
    expect(draw(plain).container.querySelector('[data-indicators]')).toBeNull();
  });
});
